import { R, type Result } from "@alliance/common/result";
import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
} from "@alliance/common/waitlistEmail";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InviteFeedEvents } from "src/invite-feed.events";
import { EmailStatus, type Mail } from "src/mail/mail.entity";
import { MailNotSentError, MailService } from "src/mail/mail.service";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgSessionLock } from "src/notifs/lock-utils";
import {
  signupUrl,
  waitlistUnsubscribeLink,
  withRef,
} from "src/search/approutes";
import { DataSource } from "typeorm";
import {
  WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "./entities/waitlist-email-recipient.entity";
import { WaitlistEntryActionKind } from "./entities/waitlist-entry-action.entity";
import { skipReason, waitlistEmailValues } from "./waitlist-email-audience";
import {
  missingValuesMessage,
  renderWaitlistEmail,
} from "./waitlist-email-render";
import { ENTRY_INVITE_CLAIMED_SQL } from "./waitlist-entry-admin.service";
import { WaitlistInviteService } from "./waitlist-invite.service";
import { recordMobilization } from "./waitlist-mobilization";

type PreparedEmail = {
  recipient: WaitlistEmailRecipient;
  email: string;
  mobilize: boolean;
  staffUserId: number | null;
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
};

export type SendOutcome = {
  status:
    | WaitlistEmailRecipientStatus.Sent
    | WaitlistEmailRecipientStatus.Pending
    | WaitlistEmailRecipientStatus.Failed
    | WaitlistEmailRecipientStatus.Uncertain;
  error: string | null;
  /** Whether sending waits for a later run rather than trying the next recipient. */
  stopsRun: boolean;
};

// A refusal of this recipient, or of this message, fails the recipient. A
// temporary refusal of either also stops the run, since the next message may
// meet it too; failing rather than retrying keeps one message from holding up
// the queue. Any other 4xx or 5xx reply, such as to the greeting, login, or
// sender, or a 421 closing the session wherever it comes, refuses the session,
// and the codes below, a failed connect, and nodemailer's connect and greeting
// timeouts, which only their messages tell apart from a timeout after sending,
// mean nothing reached the server: those leave the recipient for a later run,
// since failing it would fail every recipient after it too. Any other error may
// have come after the server took the message, including ECONNECTION without a
// reply, which nodemailer also reports for a connection dropped after the
// message was sent.
const NOT_YET_SENT_CODES = new Set(["EAUTH", "EDNS"]);
const SESSION_CLOSING_CODE = 421;
const NOT_YET_SENT_TIMEOUTS = new Set([
  "Connection timeout",
  "Greeting never received",
]);
const MESSAGE_ERROR_CODES = new Set(["EENVELOPE", "EMESSAGE"]);

type SendErrorClass = Pick<SendOutcome, "status" | "stopsRun">;

function classifySendError(error: unknown): SendErrorClass {
  const waits: SendErrorClass = {
    status: WaitlistEmailRecipientStatus.Pending,
    stopsRun: true,
  };
  const fails: SendErrorClass = {
    status: WaitlistEmailRecipientStatus.Failed,
    stopsRun: false,
  };
  const uncertain: SendErrorClass = {
    status: WaitlistEmailRecipientStatus.Uncertain,
    stopsRun: true,
  };
  if (error instanceof MailNotSentError) return waits;
  if (typeof error !== "object" || error === null) return uncertain;
  const field = (name: string): unknown =>
    name in error ? Reflect.get(error, name) : undefined;
  const code = field("code");
  const command = field("command");
  const responseCode = field("responseCode");
  if (typeof code === "string" && NOT_YET_SENT_CODES.has(code)) return waits;
  if (field("syscall") === "connect") return waits;
  if (
    code === "ETIMEDOUT" &&
    error instanceof Error &&
    NOT_YET_SENT_TIMEOUTS.has(error.message)
  ) {
    return waits;
  }
  if (typeof responseCode === "number" && responseCode >= 400) {
    if (
      (command === "RCPT TO" || command === "DATA") &&
      responseCode !== SESSION_CLOSING_CODE
    ) {
      return { ...fails, stopsRun: responseCode < 500 };
    }
    return waits;
  }
  // Raised before the server was asked, about this message's envelope or size.
  if (
    typeof code === "string" &&
    MESSAGE_ERROR_CODES.has(code) &&
    typeof responseCode !== "number"
  ) {
    return fails;
  }
  return uncertain;
}

const sendErrorOutcome = (error: unknown): SendOutcome => ({
  ...classifySendError(error),
  error: error instanceof Error ? error.message : String(error),
});

function mailOutcome(status: EmailStatus): SendOutcome {
  switch (status) {
    case EmailStatus.Sent:
      return {
        status: WaitlistEmailRecipientStatus.Sent,
        error: null,
        stopsRun: false,
      };
    case EmailStatus.Failed:
      return {
        status: WaitlistEmailRecipientStatus.Failed,
        error: "The mail server accepted no recipient",
        stopsRun: false,
      };
    case EmailStatus.Pending:
      return {
        status: WaitlistEmailRecipientStatus.Failed,
        error: "Mail delivery is off on this server",
        stopsRun: false,
      };
    default:
      throw new Error(`unknown email status: ${status satisfies never}`);
  }
}

export const sendOutcome = (sent: Result<Mail, unknown>): SendOutcome =>
  sent.ok ? mailOutcome(sent.value.status) : sendErrorOutcome(sent.error);

/**
 * Sends pending waitlist email recipients one at a time. One run at a time
 * across servers holds the advisory lock, so a recipient still `sending` when
 * a run starts was interrupted, and becomes uncertain rather than resent.
 */
@Injectable()
export class WaitlistEmailSender {
  private readonly logger = new Logger(WaitlistEmailSender.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inviteService: WaitlistInviteService,
  ) {}

  /** Never rejects. Returns at once while another run holds the lock. */
  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    const ran = await R.fromPromiseFn(() => this.runLocked());
    if (R.isFailure(ran)) {
      this.logger.error("Waitlist email sending stopped", ran.error);
    }
  }

  private async runLocked(): Promise<void> {
    await withPgSessionLock(
      this.dataSource,
      ...LOCK_KEYS.waitlistEmail,
      async () => {
        await this.markInterrupted();
        if (
          (await this.nextPending()) !== null &&
          !(await this.mailService.verifyTransport())
        ) {
          this.logger.warn(
            "Waitlist email sending waits: the mail server can't be reached",
          );
          return;
        }
        for (
          let next = await this.nextPending();
          next !== null;
          next = await this.nextPending()
        ) {
          if (await this.sendOne(next)) break;
        }
      },
    );
  }

  private async markInterrupted(): Promise<void> {
    await this.dataSource.getRepository(WaitlistEmailRecipient).update(
      { status: WaitlistEmailRecipientStatus.Sending },
      {
        status: WaitlistEmailRecipientStatus.Uncertain,
        error: "Sending stopped before the mail server answered",
      },
    );
  }

  private async nextPending(): Promise<number | null> {
    const next = await this.dataSource
      .getRepository(WaitlistEmailRecipient)
      .findOne({
        select: { id: true },
        where: { status: WaitlistEmailRecipientStatus.Pending },
        order: { id: "ASC" },
      });
    return next?.id ?? null;
  }

  /**
   * Resolves to whether the run should stop, leaving the rest pending for a
   * later one.
   */
  private async sendOne(recipientId: number): Promise<boolean> {
    const preparing = await R.fromPromiseFn(() => this.prepare(recipientId));
    // An unexpected error may be the next recipient's too, so the run stops
    // after failing this one rather than failing the whole queue.
    if (R.isFailure(preparing)) {
      await this.dataSource.getRepository(WaitlistEmailRecipient).update(
        { id: recipientId, status: WaitlistEmailRecipientStatus.Pending },
        {
          status: WaitlistEmailRecipientStatus.Failed,
          error: R.toError(preparing.error).message,
        },
      );
      this.logger.warn(
        `Waitlist email sending waits: preparing recipient ${recipientId} failed`,
        preparing.error,
      );
      return true;
    }
    const prepared = preparing.value;
    if (!prepared) return false;
    const sent = await R.fromPromise(
      this.mailService.sendWaitlistStaffEmail({
        recipient: prepared.email,
        content: {
          subject: prepared.subject,
          bodyHtml: prepared.bodyHtml,
          unsubscribeUrl: prepared.unsubscribeUrl,
        },
      }),
    );
    const outcome = sendOutcome(sent);
    if (outcome.stopsRun) {
      this.logger.warn(
        `Waitlist email sending waits after recipient ${recipientId}: ${outcome.status}`,
      );
    }
    await this.record({ prepared, outcome });
    return outcome.stopsRun;
  }

  /**
   * Skips or fails the recipient, or renders their email and marks them
   * sending. Resolves to null unless the email should go out.
   */
  private async prepare(recipientId: number): Promise<PreparedEmail | null> {
    let issued = false;
    const prepared = await this.dataSource.transaction(async (manager) => {
      // Claiming only a still-pending recipient, under a row lock, keeps two
      // runs from both sending it even if the advisory lock is lost.
      const stillPending = await manager.findOne(WaitlistEmailRecipient, {
        where: {
          id: recipientId,
          status: WaitlistEmailRecipientStatus.Pending,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!stillPending) return null;
      const recipient = await manager.findOneOrFail(WaitlistEmailRecipient, {
        where: { id: recipientId },
        relations: { batch: true, entry: { organization: true } },
      });
      const { batch, entry } = recipient;
      if (!batch || !entry) {
        throw new Error(`waitlist email recipient ${recipientId} not loaded`);
      }
      const claimed = await manager
        .createQueryBuilder()
        .from("waitlist_entry", "entry")
        .where("entry.id = :entryId", { entryId: entry.id })
        .andWhere(ENTRY_INVITE_CLAIMED_SQL)
        .getExists();
      const skipped = skipReason({
        candidate: { entry, claimed },
        includeClaimed: batch.includeClaimed,
      });
      if (skipped) {
        await manager.update(WaitlistEmailRecipient, recipientId, {
          status: WaitlistEmailRecipientStatus.Skipped,
          skipReason: skipped,
          error: null,
        });
        return null;
      }
      const { email } = entry;
      if (email === null) {
        throw new Error(`waitlist entry ${entry.id} has no email to send to`);
      }

      const invite = findWaitlistEmailPlaceholders([
        batch.subject,
        batch.body,
      ]).used.has(WaitlistEmailPlaceholder.SignupLink)
        ? await this.inviteService.inviteFor(manager, entry)
        : null;
      issued = invite?.issued ?? false;
      const rendered = renderWaitlistEmail({
        subject: batch.subject,
        body: batch.body,
        values: waitlistEmailValues({
          entry,
          signupLink: invite && withRef(signupUrl(true), invite.invite.code),
        }),
      });
      if (R.isFailure(rendered)) {
        await manager.update(WaitlistEmailRecipient, recipientId, {
          status: WaitlistEmailRecipientStatus.Failed,
          error: missingValuesMessage(rendered.error),
        });
        return null;
      }
      const unsubscribeUrl = waitlistUnsubscribeLink(entry.unsubscribeToken);
      await manager.update(WaitlistEmailRecipient, recipientId, {
        status: WaitlistEmailRecipientStatus.Sending,
        attemptedAt: new Date(),
        error: null,
        inviteId: invite?.invite.id ?? null,
        renderedSubject: rendered.value.subject,
        renderedHtml: await this.mailService.renderWaitlistStaffEmail({
          ...rendered.value,
          unsubscribeUrl,
        }),
      });
      return {
        recipient,
        email,
        mobilize: batch.mobilize,
        staffUserId: batch.staffUserId,
        ...rendered.value,
        unsubscribeUrl,
      };
    });
    if (issued) this.eventEmitter.emit(InviteFeedEvents.Created);
    return prepared;
  }

  private async record(params: {
    prepared: PreparedEmail;
    outcome: SendOutcome;
  }): Promise<void> {
    const { prepared, outcome } = params;
    const sent = outcome.status === WaitlistEmailRecipientStatus.Sent;
    await this.dataSource.transaction(async (manager) => {
      await manager.update(WaitlistEmailRecipient, prepared.recipient.id, {
        status: outcome.status,
        error: outcome.error,
        acceptedAt: sent ? new Date() : null,
      });
      if (sent && prepared.mobilize) {
        await recordMobilization({
          manager,
          entryIds: [prepared.recipient.entryId],
          kind: WaitlistEntryActionKind.EmailMobilize,
          staffUserId: prepared.staffUserId,
        });
      }
    });
  }
}
