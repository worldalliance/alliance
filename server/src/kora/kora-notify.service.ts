import { KORA_REVIEW_PATH, KoraProjectStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { siteBaseUrl } from "src/search/approutes";
import type { Repository } from "src/utils/Repository";
import { DataSource, IsNull } from "typeorm";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { KORA_LAUNCH_SUBJECT, koraLaunchText } from "./kora-launch-copy";
import { KoraProjectService } from "./kora-project.service";

export enum KoraNotifyError {
  NotActive = "not_active",
}

type Claimed = { id: string; email: string | null; phoneNumber: string | null };

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
  ) {}

  toNotify(): Promise<number> {
    return this.participants.countBy({ launchNotifiedAt: IsNull() });
  }

  /** Starts sending in the background and returns how many are waiting. */
  async notifyWaitlist(): Promise<Result<{ queued: number }, KoraNotifyError>> {
    const project = await this.projectService.project();
    if (project.status !== KoraProjectStatus.Active) {
      return R.failure(KoraNotifyError.NotActive);
    }
    const queued = await this.toNotify();
    void this.sendAll().catch((error: unknown) =>
      this.logger.error("Kora launch notice stopped", error),
    );
    return R.success({ queued });
  }

  async sendAll(): Promise<{ sent: number; failed: number }> {
    const origin = siteBaseUrl();
    if (!origin) {
      throw new Error("APP_URL is not set, so the launch link has no host");
    }
    const url = `${origin}${KORA_REVIEW_PATH}`;
    const failed: string[] = [];
    let sent = 0;
    for (;;) {
      const participant = await this.claimNext(failed);
      if (!participant) break;
      if (await this.deliver(participant, url)) {
        sent++;
      } else {
        failed.push(participant.id);
        await this.participants.update(participant.id, {
          launchNotifiedAt: null,
        });
      }
    }
    this.logger.log(
      `Kora launch notice: ${sent} sent, ${failed.length} failed`,
    );
    return { sent, failed: failed.length };
  }

  // Marking a participant notified before sending, under SKIP LOCKED, keeps two
  // runs from messaging the same person; a failed send clears the mark again.
  private async claimNext(skip: string[]): Promise<Claimed | null> {
    const [rows]: [Claimed[], number] = await this.dataSource.query(
      `UPDATE "kora_participant" SET "launchNotifiedAt" = now()
       WHERE "id" = (
         SELECT "id" FROM "kora_participant"
         WHERE "launchNotifiedAt" IS NULL AND NOT ("id" = ANY($1::uuid[]))
         ORDER BY "createdAt"
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING "id", "email", "phoneNumber"`,
      [skip],
    );
    return rows[0] ?? null;
  }

  private async deliver(participant: Claimed, url: string): Promise<boolean> {
    if (participant.email !== null) {
      const sent = await this.mailService.sendUnrecordedMail({
        recipient: participant.email,
        emailType: EmailType.KoraLaunch,
        subject: KORA_LAUNCH_SUBJECT,
        context: { url },
      });
      return sent.ok;
    }
    if (participant.phoneNumber !== null) {
      const sent = await this.mmsService.sendUnrecordedText({
        to: participant.phoneNumber,
        body: koraLaunchText(url),
      });
      return sent.ok;
    }
    this.logger.error(`Kora participant ${participant.id} has no contact`);
    return false;
  }
}
