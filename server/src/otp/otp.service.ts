import { OtpError } from "@alliance/common/otp";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { max } from "date-fns";
import { randomUUID } from "node:crypto";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { DataSource, type EntityManager, LessThan, MoreThan } from "typeorm";
import { OtpChallenge } from "./otp-challenge.entity";
import {
  generateOtpCode,
  ipRateKey,
  otpCodeDigest,
  otpRateBucket,
} from "./otp-code";
import { OtpChannel, otpEmail, OtpPurpose, otpText } from "./otp-copy";
import {
  LONGEST_RATE_WINDOW_MS,
  OTP_MAX_WRONG_ATTEMPTS,
  OTP_RESEND_AFTER_MS,
  OTP_TTL_MS,
  type RateLimit,
  SEND_LIMITS_PER_CONTACT,
  SEND_LIMITS_PER_IP,
  VERIFY_LIMITS_PER_IP,
} from "./otp-limits";
import { OtpRateEvent } from "./otp-rate-event.entity";

export type OtpContact = { channel: OtpChannel; destination: string };

export type PendingOtp = OtpContact & {
  expiresAt: Date;
  resendAvailableAt: Date;
};

type Throttled = { error: OtpError.Throttled; retryAt: Date };

export type OtpStartRefusal = Throttled | { error: OtpError.DeliveryFailed };

export type OtpVerifyRefusal =
  | Throttled
  | { error: OtpError.WrongCode }
  | { error: OtpError.CodeInvalid };

type LimitedBucket = { bucket: string; limits: RateLimit[] };

const throttled = (retryAt: Date): Throttled => ({
  error: OtpError.Throttled,
  retryAt,
});

const later = (date: Date, ms: number): Date => new Date(date.getTime() + ms);

function pendingOf(challenge: OtpChallenge): PendingOtp {
  return {
    channel: challenge.channel,
    destination: challenge.destination,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: later(challenge.createdAt, OTP_RESEND_AFTER_MS),
  };
}

/**
 * Sends and checks one-time codes. The browser that asked for a code holds
 * the token naming its challenge; the code alone selects nothing.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OtpChallenge)
    private readonly challenges: Repository<OtpChallenge>,
    @InjectRepository(OtpRateEvent)
    private readonly rateEvents: Repository<OtpRateEvent>,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
  ) {}

  /** Replaces any earlier code for the same purpose and destination, in every browser. */
  async start(params: {
    purpose: OtpPurpose;
    contact: OtpContact;
    ip: string;
    webOtpHost: string;
  }): Promise<
    Result<{ browserToken: string; pending: PendingOtp }, OtpStartRefusal>
  > {
    const { purpose, contact, ip, webOtpHost } = params;
    const now = new Date();
    const browserToken = randomToken(32);
    const code = generateOtpCode();
    const id = randomUUID();
    const challenge = this.challenges.create({
      id,
      purpose,
      ...contact,
      browserTokenHash: hashToken(browserToken),
      codeDigest: otpCodeDigest({
        challengeId: id,
        destination: contact.destination,
        code,
      }),
      wrongAttempts: 0,
      expiresAt: later(now, OTP_TTL_MS),
      createdAt: now,
    });
    const limited: LimitedBucket[] = [
      {
        bucket: otpRateBucket([
          "send-contact",
          contact.destination.toLowerCase(),
        ]),
        limits: SEND_LIMITS_PER_CONTACT,
      },
      {
        bucket: otpRateBucket(["send-ip", ipRateKey(ip)]),
        limits: SEND_LIMITS_PER_IP,
      },
    ];

    const claimed = await this.dataSource.transaction(
      async (manager): Promise<Result<void, Throttled>> => {
        await lockBuckets(manager, limited);
        const latest = await manager.findOne(OtpChallenge, {
          where: { purpose, destination: contact.destination },
          order: { createdAt: "DESC" },
        });
        const resendAt = latest && later(latest.createdAt, OTP_RESEND_AFTER_MS);
        if (resendAt && resendAt > now) {
          return R.failure(throttled(resendAt));
        }
        const retryAt = await claimRateEvents({ manager, limited, now });
        if (retryAt) {
          return R.failure(throttled(retryAt));
        }
        await manager.delete(OtpChallenge, {
          purpose,
          destination: contact.destination,
        });
        await manager.insert(OtpChallenge, challenge);
        return R.success(undefined);
      },
    );
    if (!claimed.ok) {
      return claimed;
    }

    if (!(await this.deliver({ purpose, contact, code, webOtpHost }))) {
      await this.challenges.delete({ id });
      return R.failure({ error: OtpError.DeliveryFailed });
    }
    return R.success({ browserToken, pending: pendingOf(challenge) });
  }

  /**
   * Succeeds at most once per challenge. Each guess takes an attempt before
   * its comparison, so parallel guesses cannot outrun the cap.
   */
  async verify(params: {
    purpose: OtpPurpose;
    browserToken: string;
    code: string;
    ip: string;
  }): Promise<Result<OtpContact, OtpVerifyRefusal>> {
    const { purpose, browserToken, code, ip } = params;
    const now = new Date();
    const limited: LimitedBucket[] = [
      {
        bucket: otpRateBucket(["verify-ip", ipRateKey(ip)]),
        limits: VERIFY_LIMITS_PER_IP,
      },
    ];
    const retryAt = await this.dataSource.transaction(async (manager) => {
      await lockBuckets(manager, limited);
      return claimRateEvents({ manager, limited, now });
    });
    if (retryAt) {
      return R.failure(throttled(retryAt));
    }

    const challenge = await this.usableChallenge({
      purpose,
      browserToken,
      now,
    });
    if (!challenge) {
      return R.failure({ error: OtpError.CodeInvalid });
    }
    const reserved = await this.challenges
      .createQueryBuilder()
      .update()
      .set({ wrongAttempts: () => `"wrongAttempts" + 1` })
      .where(
        `id = :id AND "expiresAt" > :now AND "wrongAttempts" < :maxWrong`,
        { id: challenge.id, now, maxWrong: OTP_MAX_WRONG_ATTEMPTS },
      )
      .returning(`"codeDigest", "wrongAttempts"`)
      .execute();
    const [row]: { codeDigest: string; wrongAttempts: number }[] = reserved.raw;
    if (!row) {
      return R.failure({ error: OtpError.CodeInvalid });
    }
    const digest = otpCodeDigest({
      challengeId: challenge.id,
      destination: challenge.destination,
      code,
    });
    if (row.codeDigest !== digest) {
      return row.wrongAttempts >= OTP_MAX_WRONG_ATTEMPTS
        ? R.failure({ error: OtpError.CodeInvalid })
        : R.failure({ error: OtpError.WrongCode });
    }

    const consumed = await this.challenges
      .createQueryBuilder()
      .delete()
      .where("id = :id", { id: challenge.id })
      .returning("id")
      .execute();
    return consumed.raw.length > 0
      ? R.success({
          channel: challenge.channel,
          destination: challenge.destination,
        })
      : R.failure({ error: OtpError.CodeInvalid });
  }

  async pending(params: {
    purpose: OtpPurpose;
    browserToken: string;
  }): Promise<PendingOtp | null> {
    const challenge = await this.usableChallenge({
      ...params,
      now: new Date(),
    });
    return challenge && pendingOf(challenge);
  }

  async abandon(params: {
    purpose: OtpPurpose;
    browserToken: string;
  }): Promise<void> {
    await this.challenges.delete({
      purpose: params.purpose,
      browserTokenHash: hashToken(params.browserToken),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async forgetExpired(): Promise<void> {
    const now = new Date();
    await this.challenges.delete({ expiresAt: LessThan(now) });
    await this.rateEvents.delete({
      createdAt: LessThan(new Date(now.getTime() - LONGEST_RATE_WINDOW_MS)),
    });
  }

  private async usableChallenge(params: {
    purpose: OtpPurpose;
    browserToken: string;
    now: Date;
  }): Promise<OtpChallenge | null> {
    const challenge = await this.challenges.findOneBy({
      purpose: params.purpose,
      browserTokenHash: hashToken(params.browserToken),
      expiresAt: MoreThan(params.now),
    });
    return challenge && challenge.wrongAttempts < OTP_MAX_WRONG_ATTEMPTS
      ? challenge
      : null;
  }

  private async deliver(params: {
    purpose: OtpPurpose;
    contact: OtpContact;
    code: string;
    webOtpHost: string;
  }): Promise<boolean> {
    const { purpose, contact, code, webOtpHost } = params;
    switch (contact.channel) {
      case OtpChannel.Email: {
        const { subject, context } = otpEmail({ purpose, code });
        const sent = await this.mailService.sendUnrecordedMail({
          recipient: contact.destination,
          emailType: EmailType.OtpCode,
          subject,
          context,
        });
        return sent.ok;
      }
      case OtpChannel.Sms: {
        const sent = await this.mmsService.sendUnrecordedText({
          to: contact.destination,
          body: otpText({ purpose, code, webOtpHost }),
        });
        return sent.ok;
      }
      default:
        throw new Error(`unknown channel: ${contact.channel satisfies never}`);
    }
  }
}

async function lockBuckets(
  manager: EntityManager,
  limited: LimitedBucket[],
): Promise<void> {
  // Sorted, so two requests sharing buckets cannot deadlock.
  for (const bucket of limited.map((l) => l.bucket).sort()) {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [bucket],
    );
  }
}

/**
 * When every exhausted limit has freed up, or null after counting this
 * request against every bucket. Call with the buckets locked.
 */
async function claimRateEvents(params: {
  manager: EntityManager;
  limited: LimitedBucket[];
  now: Date;
}): Promise<Date | null> {
  const { manager, limited, now } = params;
  const retryAts: Date[] = [];
  for (const { bucket, limits } of limited) {
    for (const limit of limits) {
      const [oldestCounted] = await manager.find(OtpRateEvent, {
        where: {
          bucket,
          createdAt: MoreThan(new Date(now.getTime() - limit.windowMs)),
        },
        order: { createdAt: "DESC" },
        skip: limit.max - 1,
        take: 1,
      });
      if (oldestCounted) {
        retryAts.push(later(oldestCounted.createdAt, limit.windowMs));
      }
    }
  }
  if (retryAts.length > 0) {
    return max(retryAts);
  }
  await manager.insert(
    OtpRateEvent,
    limited.map(({ bucket }) => ({ bucket, createdAt: now })),
  );
  return null;
}
