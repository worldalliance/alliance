import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { MailService, type WaitlistEmailType } from "src/mail/mail.service";
import {
  waitlistShareLink,
  waitlistUnsubscribeLink,
} from "src/search/approutes";
import type { Repository } from "src/utils/Repository";
import { DataSource } from "typeorm";
import { z } from "zod";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";

/** Null, and public sending off, until the cap is set. */
export function publicMailDailyCap(): number | null {
  const cap = process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;
  if (!cap) {
    return null;
  }
  const parsed = z.coerce.number().int().positive().safeParse(cap);
  if (!parsed.success) {
    throw new Error(
      `WAITLIST_PUBLIC_MAIL_DAILY_CAP must be a positive integer, got "${cap}"`,
    );
  }
  return parsed.data;
}

export enum MailClaim {
  Claimed = "claimed",
  ClaimedLastOfDay = "claimed_last_of_day",
  RecipientLimited = "recipient_limited",
  DailyCapReached = "daily_cap_reached",
}

export function decideClaim(params: {
  recipientLimited: boolean;
  sentToday: number;
  dailyCap: number;
}): MailClaim {
  const { recipientLimited, sentToday, dailyCap } = params;
  if (recipientLimited) {
    return MailClaim.RecipientLimited;
  }
  if (sentToday >= dailyCap) {
    return MailClaim.DailyCapReached;
  }
  return sentToday + 1 === dailyCap
    ? MailClaim.ClaimedLastOfDay
    : MailClaim.Claimed;
}

const SENDS: Record<MailClaim, boolean> = {
  [MailClaim.Claimed]: true,
  [MailClaim.ClaimedLastOfDay]: true,
  [MailClaim.RecipientLimited]: false,
  [MailClaim.DailyCapReached]: false,
};

const claimedRowSchema = z.object({
  recipientLimited: z.boolean(),
  sentToday: z.number().int(),
});

@Injectable()
export class WaitlistMailService {
  private readonly logger = new Logger(WaitlistMailService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
    private readonly mailService: MailService,
    private readonly eventLogService: EventLogService,
  ) {}

  /**
   * Mails an entry its personal link, unless there is no subscribed entry for
   * the address or the address or the day is out of allowance. Never rejects.
   * A failed send keeps its claim, so failures cannot retry past the limits.
   */
  async sendShareLink(params: {
    email: string;
    emailType: WaitlistEmailType;
  }): Promise<void> {
    const sent = await R.fromPromiseFn(() => this.trySendShareLink(params));
    if (R.isFailure(sent)) {
      this.logger.error("Failed to send a waitlist link email", sent.error);
    }
  }

  private async trySendShareLink({
    email,
    emailType,
  }: {
    email: string;
    emailType: WaitlistEmailType;
  }): Promise<void> {
    const dailyCap = publicMailDailyCap();
    if (dailyCap === null) {
      return;
    }
    const entry = await this.entryRepository.findOneBy({ email });
    if (!entry || entry.unsubscribedAt) {
      return;
    }
    const claim = await this.claim(entry.email, dailyCap);
    switch (claim) {
      case MailClaim.RecipientLimited:
        return;
      case MailClaim.DailyCapReached:
        this.logger.warn("Waitlist email skipped: the daily cap is reached");
        return;
      case MailClaim.ClaimedLastOfDay:
        await this.eventLogService.sendMessage({
          type: EventType.WaitlistMailCapReached,
          message: `Public waitlist email reached its daily cap of ${dailyCap}. Confirmation and link emails stop until 00:00 UTC.`,
          blob: null,
          userId: null,
        });
        break;
      case MailClaim.Claimed:
        break;
      default:
        throw new Error(`unknown mail claim: ${claim satisfies never}`);
    }
    await this.mailService.sendWaitlistLinkEmail({
      recipient: entry.email,
      emailType,
      url: waitlistShareLink(entry.code),
      unsubscribeUrl: waitlistUnsubscribeLink(entry.unsubscribeToken),
    });
  }

  /**
   * One public email per address per 24 hours, and at most `dailyCap` per UTC
   * day. The lock makes the check and the claim atomic across requests.
   */
  private claim(email: string, dailyCap: number): Promise<MailClaim> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["waitlist-mail-allowance"],
      );
      const [row] = await manager.query(
        `SELECT
          EXISTS (
            SELECT 1 FROM waitlist_mail_allowance
            WHERE email = $1 AND "claimedAt" > now() - interval '24 hours'
          ) AS "recipientLimited",
          (
            SELECT count(*)::int FROM waitlist_mail_allowance
            WHERE "claimedAt" >= date_trunc('day', now(), 'UTC')
          ) AS "sentToday"`,
        [email],
      );
      const claim = decideClaim({
        ...claimedRowSchema.parse(row),
        dailyCap,
      });
      if (SENDS[claim]) {
        await manager.query(
          `INSERT INTO waitlist_mail_allowance (email, "claimedAt") VALUES ($1, now())
          ON CONFLICT (email) DO UPDATE SET "claimedAt" = excluded."claimedAt"`,
          [email],
        );
      }
      return claim;
    });
  }
}
