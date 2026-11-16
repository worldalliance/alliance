import { KORA_REVIEW_PATH, KoraProjectStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { PushService } from "src/push/push.service";
import { siteBaseUrl } from "src/search/approutes";
import type { Repository } from "src/utils/Repository";
import { DataSource, IsNull } from "typeorm";
import { KoraParticipant } from "./entities/kora-participant.entity";
import {
  KORA_LAUNCH_SUBJECT,
  KORA_MORE_PUSH,
  KORA_MORE_SUBJECT,
  koraLaunchText,
  koraMoreText,
} from "./kora-notify-copy";
import { KoraProjectService } from "./kora-project.service";

export enum KoraNotice {
  /** The waitlist's "reviews are open". */
  Launch = "launch",
  /** "More reviews are ready", to reviewers who finished an assignment. */
  More = "more",
}

export enum KoraNotifyError {
  NotActive = "not_active",
}

type Contact = { email: string | null; phoneNumber: string | null };

type Claimed = {
  id: string;
  /** Undoes the claim when the message couldn't be delivered. */
  release: () => Promise<void>;
  deliver: (url: string) => Promise<boolean>;
};

// A reviewer who finished an assignment, has none open, and hasn't been told
// since the newest batch arrived.
const MORE_ELIGIBLE = `r."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "kora_assignment" a WHERE a."reviewerId" = r."id"
    AND a."completedAt" IS NOT NULL AND a."deletedAt" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "kora_assignment" a WHERE a."reviewerId" = r."id"
    AND a."completedAt" IS NULL AND a."deletedAt" IS NULL)
  AND (r."moreNotifiedAt" IS NULL
    OR r."moreNotifiedAt" < (SELECT MAX("createdAt") FROM "kora_batch"))`;

@Injectable()
export class KoraNotifyService {
  private readonly logger = new Logger(KoraNotifyService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraParticipant)
    private readonly participants: Repository<KoraParticipant>,
    private readonly projectService: KoraProjectService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
  ) {}

  async toNotify(notice: KoraNotice): Promise<number> {
    switch (notice) {
      case KoraNotice.Launch:
        return this.participants.countBy({ launchNotifiedAt: IsNull() });
      case KoraNotice.More: {
        const [row]: { count: number }[] = await this.dataSource.query(
          `SELECT COUNT(*)::int AS "count" FROM "kora_reviewer" r WHERE ${MORE_ELIGIBLE}`,
        );
        return row.count;
      }
      default:
        throw new Error(`unknown notice: ${notice satisfies never}`);
    }
  }

  /** Starts sending in the background and returns how many are waiting. */
  async notify(
    notice: KoraNotice,
  ): Promise<Result<{ queued: number }, KoraNotifyError>> {
    const project = await this.projectService.project();
    if (project.status !== KoraProjectStatus.Active) {
      return R.failure(KoraNotifyError.NotActive);
    }
    const queued = await this.toNotify(notice);
    void this.sendAll(notice).catch((error: unknown) =>
      this.logger.error(`Kora ${notice} notice stopped`, error),
    );
    return R.success({ queued });
  }

  async sendAll(notice: KoraNotice): Promise<{ sent: number; failed: number }> {
    const origin = siteBaseUrl();
    if (!origin) {
      throw new Error("APP_URL is not set, so the review link has no host");
    }
    const url = `${origin}${KORA_REVIEW_PATH}`;
    const failed: string[] = [];
    let sent = 0;
    for (;;) {
      const claimed = await this.claimNext(notice, failed);
      if (!claimed) break;
      if (await claimed.deliver(url)) {
        sent++;
      } else {
        failed.push(claimed.id);
        await claimed.release();
      }
    }
    this.logger.log(
      `Kora ${notice} notice: ${sent} sent, ${failed.length} failed`,
    );
    return { sent, failed: failed.length };
  }

  // Marking someone notified before sending, under SKIP LOCKED, keeps two runs
  // from messaging the same person; a failed send undoes the mark.
  private async claimNext(
    notice: KoraNotice,
    skip: string[],
  ): Promise<Claimed | null> {
    switch (notice) {
      case KoraNotice.Launch: {
        const [rows]: [({ id: string } & Contact)[], number] =
          await this.dataSource.query(
            `UPDATE "kora_participant" SET "launchNotifiedAt" = now()
             WHERE "id" = (
               SELECT "id" FROM "kora_participant"
               WHERE "launchNotifiedAt" IS NULL AND NOT ("id" = ANY($1::uuid[]))
               ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED
             )
             RETURNING "id", "email", "phoneNumber"`,
            [skip],
          );
        const row = rows[0];
        if (!row) return null;
        return {
          id: row.id,
          release: () =>
            this.participants
              .update(row.id, { launchNotifiedAt: null })
              .then(() => undefined),
          deliver: (url) => this.contact(row, notice, url),
        };
      }
      case KoraNotice.More: {
        const [rows]: [
          {
            id: string;
            participantId: string | null;
            userId: number | null;
            previous: Date | null;
          }[],
          number,
        ] = await this.dataSource.query(
          `UPDATE "kora_reviewer" r SET "moreNotifiedAt" = now()
           FROM (
             SELECT r."id", r."moreNotifiedAt" AS "previous" FROM "kora_reviewer" r
             WHERE ${MORE_ELIGIBLE} AND NOT (r."id" = ANY($1::uuid[]))
             ORDER BY r."createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED
           ) picked
           WHERE r."id" = picked."id"
           RETURNING r."id", r."participantId", r."userId", picked."previous"`,
          [skip],
        );
        const row = rows[0];
        if (!row) return null;
        return {
          id: row.id,
          release: () =>
            this.dataSource
              .query(
                `UPDATE "kora_reviewer" SET "moreNotifiedAt" = $2 WHERE "id" = $1`,
                [row.id, row.previous],
              )
              .then(() => undefined),
          deliver: async (url) => {
            if (row.userId !== null) return this.pushMember(row.userId, row.id);
            const participant = row.participantId
              ? await this.participants.findOneBy({ id: row.participantId })
              : null;
            return participant ? this.contact(participant, notice, url) : false;
          },
        };
      }
      default:
        throw new Error(`unknown notice: ${notice satisfies never}`);
    }
  }

  private async contact(
    to: Contact & { id: string },
    notice: KoraNotice,
    url: string,
  ): Promise<boolean> {
    const copy = NOTICE_COPY[notice];
    if (to.email !== null) {
      const sent = await this.mailService.sendUnrecordedMail({
        recipient: to.email,
        emailType: copy.emailType,
        subject: copy.subject,
        context: { url },
      });
      return sent.ok;
    }
    if (to.phoneNumber !== null) {
      const sent = await this.mmsService.sendUnrecordedText({
        to: to.phoneNumber,
        body: copy.text(url),
      });
      return sent.ok;
    }
    this.logger.error(`Kora participant ${to.id} has no contact`);
    return false;
  }

  /** A member with no devices can't be reached by push, so counts as told. */
  private async pushMember(
    userId: number,
    reviewerId: string,
  ): Promise<boolean> {
    const messages = await this.pushService.getPushForAllUserDevices(userId, {
      userId,
      body: KORA_MORE_PUSH,
      idempotencyKey: `kora-more-${reviewerId}-${Date.now()}`,
      screen: "/kora-review",
    });
    if (messages.length > 0) await this.pushService.sendMessages(messages);
    return true;
  }
}

const NOTICE_COPY: Record<
  KoraNotice,
  { emailType: EmailType; subject: string; text: (url: string) => string }
> = {
  [KoraNotice.Launch]: {
    emailType: EmailType.KoraLaunch,
    subject: KORA_LAUNCH_SUBJECT,
    text: koraLaunchText,
  },
  [KoraNotice.More]: {
    emailType: EmailType.KoraMoreReviews,
    subject: KORA_MORE_SUBJECT,
    text: koraMoreText,
  },
};
