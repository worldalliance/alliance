import { R, type Result } from "@alliance/common/result";
import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
} from "@alliance/common/waitlistEmail";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron, CronExpression } from "@nestjs/schedule";
import { milliseconds } from "date-fns";
import { randomUUID } from "node:crypto";
import { InviteFeedEvents } from "src/invite-feed.events";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import { EmailStatus, type Mail } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import {
  signupUrl,
  waitlistUnsubscribeLink,
  withRef,
} from "src/search/approutes";
import { mailSendError, SendErrorKind } from "src/utils/send-error";
import { DataSource, LessThan } from "typeorm";
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
  attemptId: string;
  email: string;
  mobilize: boolean;
  staffUserId: number | null;
  /** As staff wrote it, before any recipient's values went in. */
  campaignSubject: string;
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

// A refused message fails the recipient. A temporary refusal also stops the
// run, since the next message may meet it too; failing rather than retrying
// keeps one message from holding up the queue. A message never handed over
// leaves the recipient for a later run, since failing it would fail every
// recipient after it too.
const SEND_ERROR_OUTCOMES: Record<
  SendErrorKind,
  Pick<SendOutcome, "status" | "stopsRun">
> = {
  [SendErrorKind.NotHandedOver]: {
    status: WaitlistEmailRecipientStatus.Pending,
    stopsRun: true,
  },
  [SendErrorKind.Refused]: {
    status: WaitlistEmailRecipientStatus.Failed,
    stopsRun: false,
  },
  [SendErrorKind.RefusedForNow]: {
    status: WaitlistEmailRecipientStatus.Failed,
    stopsRun: true,
  },
  [SendErrorKind.Unknown]: {
    status: WaitlistEmailRecipientStatus.Uncertain,
    stopsRun: true,
  },
};

const sendErrorOutcome = (error: unknown): SendOutcome => ({
  ...SEND_ERROR_OUTCOMES[mailSendError(error)],
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
        error:
          "Mail delivery is off on this server, or the address accepts no mail",
        stopsRun: false,
      };
    default:
      throw new Error(`unknown email status: ${status satisfies never}`);
  }
}

export const sendOutcome = (sent: Result<Mail, unknown>): SendOutcome =>
  sent.ok ? mailOutcome(sent.value.status) : sendErrorOutcome(sent.error);

// Longer than nodemailer's 10-minute idle socket timeout, so a send another
// run still has in flight is rarely labelled uncertain.
const INTERRUPTED_AFTER_MINUTES = 15;

/**
 * Sends pending waitlist email recipients one at a time. Another run may still
 * be sending a recipient left `sending`, so it becomes uncertain, never
 * resent, only once INTERRUPTED_AFTER_MINUTES have passed without an answer.
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

  /** Never rejects. Returns at once while another run holds the lease. */
  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    const ran = await R.fromPromiseFn(() => this.sendDueLeased());
    if (R.isFailure(ran)) {
      this.logger.error("Waitlist email sending stopped", ran.error);
    }
  }

  @WithoutOverlapping({ key: CronLease.WaitlistEmails })
  private async sendDueLeased(): Promise<void> {
    await this.sendDue();
  }

  /** Skips the lease; production runs it through run. */
  async sendDue(): Promise<void> {
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
      assertLeaseHeld();
      if (await this.sendOne(next)) break;
    }
  }

  private async markInterrupted(): Promise<void> {
    await this.dataSource.getRepository(WaitlistEmailRecipient).update(
      {
        status: WaitlistEmailRecipientStatus.Sending,
        attemptedAt: LessThan(
          new Date(
            Date.now() - milliseconds({ minutes: INTERRUPTED_AFTER_MINUTES }),
          ),
        ),
      },
      {
        status: WaitlistEmailRecipientStatus.Uncertain,
        error: `No answer was recorded within ${INTERRUPTED_AFTER_MINUTES} minutes of sending`,
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
        tracking: {
          owner: { waitlistEntryId: prepared.recipient.entryId },
          source: MessageSource.WaitlistCampaign,
          context: {
            waitlistEmailBatchId: prepared.recipient.batchId,
            waitlistEmailRecipientId: prepared.recipient.id,
            subject: prepared.campaignSubject,
          },
          actionEventNotifId: null,
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
      // runs from both sending it even if the lease is lost.
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
      const attemptId = randomUUID();
      await manager.update(WaitlistEmailRecipient, recipientId, {
        status: WaitlistEmailRecipientStatus.Sending,
        attemptedAt: new Date(),
        attemptId,
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
        attemptId,
        email,
        mobilize: batch.mobilize,
        staffUserId: batch.staffUserId,
        campaignSubject: batch.subject,
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
    const values = {
      status: outcome.status,
      error: outcome.error,
      acceptedAt: sent ? new Date() : null,
    };
    await this.dataSource.transaction(async (manager) => {
      const landed = (
        await manager.update(
          WaitlistEmailRecipient,
          { id: prepared.recipient.id, attemptId: prepared.attemptId },
          values,
        )
      ).affected;
      if (!landed) {
        this.logger.warn(
          `Waitlist recipient ${prepared.recipient.id}'s ${outcome.status} result is not recorded: a retry superseded this send`,
        );
        return;
      }
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
