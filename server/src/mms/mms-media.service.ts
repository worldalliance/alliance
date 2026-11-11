import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { milliseconds } from "date-fns";
import { requireEnv } from "src/config/env";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgSessionLock } from "src/notifs/lock-utils";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import type { Repository } from "src/utils/Repository";
import { DataSource, IsNull, LessThan, Not, Raw } from "typeorm";
import { MmsMedia } from "./mms-media.entity";

export const MAX_COPY_ATTEMPTS = 30;

const MAX_BACKOFF_MINUTES = 24 * 60;

const backedOff = (attemptsColumn: string) =>
  Raw(
    (column) =>
      `coalesce(${column}, "createdAt") < now() - least(power(2, "${attemptsColumn}"), :maxMinutes) * interval '1 minute'`,
    { maxMinutes: MAX_BACKOFF_MINUTES },
  );

export enum MmsMediaStatus {
  Copying = "copying",
  Ready = "ready",
  Unavailable = "unavailable",
}

export const mediaStatus = (media: MmsMedia): MmsMediaStatus => {
  if (media.s3Key !== null) return MmsMediaStatus.Ready;
  return media.copyAttempts >= MAX_COPY_ATTEMPTS
    ? MmsMediaStatus.Unavailable
    : MmsMediaStatus.Copying;
};

const REMOTE_CALL_TIMEOUT_MS = milliseconds({ seconds: 30 });

enum CopyFailureKind {
  TwilioGone = "twilio_gone",
  Failed = "failed",
}

type CopyFailure =
  | { kind: CopyFailureKind.TwilioGone }
  | { kind: CopyFailureKind.Failed; error: Error };

const copyFailed = (error: unknown): CopyFailure => ({
  kind: CopyFailureKind.Failed,
  error: R.toError(error),
});

@Injectable()
export class MmsMediaService {
  private readonly logger = new Logger(MmsMediaService.name);

  constructor(
    @InjectRepository(MmsMedia)
    private readonly mediaRepository: Repository<MmsMedia>,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
    private readonly dataSource: DataSource,
  ) {}

  /** Never rejects: a failure is logged and counted, and the cron retries it. */
  async copyToS3(media: MmsMedia[]): Promise<void> {
    for (const item of media) {
      const copied = await this.copyOne(item);
      if (copied.ok) {
        if (copied.value) await this.deleteFromTwilio([item]);
        continue;
      }
      let copyAttempts: number | (() => string);
      let twilioGone = false;
      switch (copied.error.kind) {
        case CopyFailureKind.TwilioGone:
          twilioGone = true;
          copyAttempts = MAX_COPY_ATTEMPTS;
          break;
        case CopyFailureKind.Failed:
          this.logger.error(
            `Could not copy MMS media ${item.id}: ${copied.error.error.message}`,
            copied.error.error.stack,
          );
          copyAttempts = () => `"copyAttempts" + 1`;
          break;
        default:
          throw new Error(
            `unknown copy failure: ${copied.error satisfies never}`,
          );
      }
      const counted = await R.fromPromise(
        this.mediaRepository.update(
          { id: item.id, s3Key: IsNull() },
          { copyAttempts, lastCopyAttemptAt: new Date() },
        ),
      );
      if (!counted.ok) {
        this.logger.error(
          `Could not count the failed copy of MMS media ${item.id}`,
          thrownStack(counted.error),
        );
      }
      // No row updated: another copy finished it and deleted Twilio's file.
      if (twilioGone && (!counted.ok || counted.value.affected !== 0)) {
        this.logger.error(
          `Could not copy MMS media ${item.id}: Twilio no longer has it`,
        );
      }
    }
  }

  /** Never rejects: a failure is logged and counted, and the cron retries it. */
  async deleteFromTwilio(media: MmsMedia[]): Promise<void> {
    for (const item of media) {
      const deleted = await R.fromPromiseFn(() =>
        fetch(`${item.twilioUrl}.json`, {
          method: "DELETE",
          headers: { Authorization: twilioAuthorization() },
          signal: AbortSignal.timeout(REMOTE_CALL_TIMEOUT_MS),
        }),
      );
      if (!deleted.ok || (!deleted.value.ok && deleted.value.status !== 404)) {
        this.logger.error(
          `Could not delete Twilio's copy of MMS media ${item.id}: ${
            deleted.ok
              ? `Twilio answered ${deleted.value.status}`
              : thrownMessage(deleted.error)
          }`,
        );
        const counted = await R.fromPromise(
          this.mediaRepository.update(item.id, {
            twilioDeleteAttempts: () => `"twilioDeleteAttempts" + 1`,
            lastTwilioDeleteAttemptAt: new Date(),
          }),
        );
        if (!counted.ok) {
          this.logger.error(
            `Could not count the refused deletion of MMS media ${item.id}`,
            thrownStack(counted.error),
          );
        }
        continue;
      }
      const recorded = await R.fromPromise(
        this.mediaRepository.update(item.id, { twilioDeletedAt: new Date() }),
      );
      if (!recorded.ok) {
        this.logger.error(
          `Could not record the deletion of Twilio's copy of MMS media ${item.id}`,
          thrownStack(recorded.error),
        );
      }
    }
  }

  /** The lock keeps cron runs from overlapping; a webhook's copy still can. */
  @Cron(CronExpression.EVERY_MINUTE)
  async copyPending(): Promise<void> {
    if (!notifDeliveryEnabled()) return;
    await withPgSessionLock(
      this.dataSource,
      ...LOCK_KEYS.mmsMediaCopy,
      async () => {
        await this.copyToS3(
          await this.mediaRepository.find({
            where: {
              s3Key: IsNull(),
              copyAttempts: LessThan(MAX_COPY_ATTEMPTS),
              lastCopyAttemptAt: backedOff("copyAttempts"),
            },
            order: { copyAttempts: "ASC", id: "ASC" },
            take: 50,
          }),
        );
        await this.deleteFromTwilio(
          await this.mediaRepository.find({
            where: {
              s3Key: Not(IsNull()),
              twilioDeletedAt: IsNull(),
              lastTwilioDeleteAttemptAt: backedOff("twilioDeleteAttempts"),
            },
            order: { twilioDeleteAttempts: "ASC", id: "ASC" },
            take: 50,
          }),
        );
      },
    );
  }

  /**
   * Succeeds with whether this copy claimed the row. Two copiers can race on
   * one row; a copy whose claim misses deletes its upload. A claim that rejects
   * may still have committed, so its upload is deleted only once a re-read
   * shows the row doesn't name it.
   */
  private async copyOne(
    media: MmsMedia,
  ): Promise<Result<boolean, CopyFailure>> {
    const response = await R.fromPromiseFn(() =>
      fetch(media.twilioUrl, {
        headers: { Authorization: twilioAuthorization() },
        signal: AbortSignal.timeout(REMOTE_CALL_TIMEOUT_MS),
      }),
    );
    if (!response.ok) return R.failure(copyFailed(response.error));
    if (response.value.status === 404) {
      return R.failure({ kind: CopyFailureKind.TwilioGone });
    }
    if (!response.value.ok) {
      return R.failure(
        copyFailed(`Twilio media fetch returned ${response.value.status}`),
      );
    }
    const bucket = R.fromThrowable(() => requireEnv("ASSETS_BUCKET"));
    if (!bucket.ok) return R.failure(copyFailed(bucket.error));
    const key = `mms-media/${randomUUID()}`;
    const uploaded = await R.fromPromiseFn(async () =>
      this.s3.send(
        new PutObjectCommand({
          Bucket: bucket.value,
          Key: key,
          Body: Buffer.from(await response.value.arrayBuffer()),
          ContentType: media.contentType,
        }),
        { abortSignal: AbortSignal.timeout(REMOTE_CALL_TIMEOUT_MS) },
      ),
    );
    if (!uploaded.ok) return R.failure(copyFailed(uploaded.error));
    const claimed = await R.fromPromise(
      this.mediaRepository.update(
        { id: media.id, s3Key: IsNull() },
        { s3Key: key },
      ),
    );
    if (claimed.ok && claimed.value.affected) return R.success(true);
    if (!claimed.ok) {
      const row = await R.fromPromise(
        this.mediaRepository.findOneBy({ id: media.id }),
      );
      if (!row.ok) {
        return R.failure(
          copyFailed(
            `Kept upload ${key}, unsure whether its claim committed: ${R.toError(claimed.error).message}`,
          ),
        );
      }
      if (row.value?.s3Key === key) return R.success(true);
    }
    const removed = await R.fromPromise(
      this.s3.send(
        new DeleteObjectCommand({ Bucket: bucket.value, Key: key }),
        { abortSignal: AbortSignal.timeout(REMOTE_CALL_TIMEOUT_MS) },
      ),
    );
    if (!removed.ok) {
      return R.failure(
        copyFailed(
          `Could not delete upload ${key}: ${R.toError(removed.error).message}`,
        ),
      );
    }
    if (!claimed.ok) return R.failure(copyFailed(claimed.error));
    return R.success(false);
  }
}

function twilioAuthorization(): string {
  const credentials = `${requireEnv("TWILIO_ACCOUNT_SID")}:${requireEnv("TWILIO_AUTH_TOKEN")}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}
