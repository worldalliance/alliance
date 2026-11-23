import { OtpError } from "@alliance/common/otp";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { max } from "date-fns";
import { randomUUID } from "node:crypto";
import { lockUntilCommit } from "src/datasources/advisory-lock";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import {
  DataSource,
  type EntityManager,
  IsNull,
  LessThan,
  MoreThan,
} from "typeorm";
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
  SEND_LIMITS_PER_ACCOUNT,
  SEND_LIMITS_PER_CONTACT,
  SEND_LIMITS_PER_IP,
  VERIFY_LIMITS_PER_IP,
} from "./otp-limits";
import { OtpRateEvent } from "./otp-rate-event.entity";
import { isTestPhone, TEST_PHONE_CODE } from "./test-phone";

export type OtpContact = { channel: OtpChannel; destination: string };

/** A signed-in account asking for a code, which alone can use it. */
export type OtpRequester = {
  userId: number;
  /** Skips the contact's limit, so others' sends can't keep it from its own contact. */
  holdsContact: boolean;
};

export type PendingOtp = OtpContact & {
  expiresAt: Date;
  resendAvailableAt: Date;
};

type Throttled = { error: OtpError.Throttled; retryAt: Date };

export type StartedOtp = { browserToken: string; pending: PendingOtp };

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

const ownedBy = (userId: number | null) => userId ?? IsNull();

/**
 * A signed-in requester counts against its own limit and, unless it already
 * holds the contact, the contact's limit for this purpose alone, so no one
 * else can spend the limits it needs. Without one, the contact's limit is
 * shared by every request.
 */
function sendBuckets(params: {
  purpose: OtpPurpose;
  destination: string;
  requester: OtpRequester | null;
  ip: string;
}): LimitedBucket[] {
  const { purpose, requester, ip } = params;
  const destination = params.destination.toLowerCase();
  const perIp = {
    bucket: otpRateBucket(["send-ip", ipRateKey(ip)]),
    limits: SEND_LIMITS_PER_IP,
  };
  if (!requester) {
    return [
      {
        bucket: otpRateBucket(["send-contact", destination]),
        limits: SEND_LIMITS_PER_CONTACT,
      },
      perIp,
    ];
  }
  const perAccount = {
    bucket: otpRateBucket(["send-account", String(requester.userId)]),
    limits: SEND_LIMITS_PER_ACCOUNT,
  };
  return requester.holdsContact
    ? [perAccount, perIp]
    : [
        perAccount,
        {
          bucket: otpRateBucket(["send-contact", purpose, destination]),
          limits: SEND_LIMITS_PER_CONTACT,
        },
        perIp,
      ];
}

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

  /**
   * Replaces the requester's earlier code for the same purpose and
   * destination, in every browser.
   */
  async start(params: {
    purpose: OtpPurpose;
    contact: OtpContact;
    requester: OtpRequester | null;
    ip: string;
    webOtpHost: string | null;
  }): Promise<Result<StartedOtp, OtpStartRefusal>> {
    const { purpose, contact, requester, ip, webOtpHost } = params;
    const userId = requester?.userId ?? null;
    const now = new Date();
    const browserToken = randomToken(32);
    const testPhone = isTestPhone(contact);
    const code = testPhone ? TEST_PHONE_CODE : generateOtpCode();
    const id = randomUUID();
    // Without the `user` relation: insert's deep-partial type over it walks
    // all of User, which CI's typecheck rejects.
    const challenge: Omit<OtpChallenge, "user"> = {
      id,
      purpose,
      ...contact,
      userId,
      browserTokenHash: hashToken(browserToken),
      codeDigest: otpCodeDigest({
        challengeId: id,
        destination: contact.destination,
        code,
      }),
      wrongAttempts: 0,
      expiresAt: later(now, OTP_TTL_MS),
      createdAt: now,
    };
    const limited = testPhone
      ? []
      : sendBuckets({
          purpose,
          destination: contact.destination,
          requester,
          ip,
        });
    const scope = {
      purpose,
      destination: contact.destination,
      userId: ownedBy(userId),
    };

    const claimed = await this.dataSource.transaction(
      async (manager): Promise<Result<void, Throttled>> => {
        await lockBuckets(manager, limited);
        const latest = await manager.findOne(OtpChallenge, {
          where: scope,
          order: { createdAt: "DESC" },
        });
        const resendAt = latest && later(latest.createdAt, OTP_RESEND_AFTER_MS);
        if (!testPhone && resendAt && resendAt > now) {
          return R.failure(throttled(resendAt));
        }
        const retryAt = await claimRateEvents({ manager, limited, now });
        if (retryAt) {
          return R.failure(throttled(retryAt));
        }
        await manager.delete(OtpChallenge, scope);
        await manager.insert(OtpChallenge, challenge);
        return R.success(undefined);
      },
    );
    if (!claimed.ok) {
      return claimed;
    }

    if (
      !testPhone &&
      !(await this.deliver({ purpose, contact, code, webOtpHost }))
    ) {
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
    userId: number | null;
    code: string;
    ip: string;
  }): Promise<Result<OtpContact, OtpVerifyRefusal>> {
    const { purpose, browserToken, userId, code, ip } = params;
    const now = new Date();
    const limited: LimitedBucket[] = [
      {
        bucket: otpRateBucket(["verify-ip", ipRateKey(ip)]),
        limits: VERIFY_LIMITS_PER_IP,
      },
    ];
    const challenge = await this.usableChallenge({
      purpose,
      browserToken,
      userId,
      now,
    });
    if (!challenge || !isTestPhone(challenge)) {
      const retryAt = await this.dataSource.transaction(async (manager) => {
        await lockBuckets(manager, limited);
        return claimRateEvents({ manager, limited, now });
      });
      if (retryAt) {
        return R.failure(throttled(retryAt));
      }
    }
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
    userId: number | null;
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
    userId: number | null;
    now: Date;
  }): Promise<OtpChallenge | null> {
    const challenge = await this.challenges.findOneBy({
      purpose: params.purpose,
      browserTokenHash: hashToken(params.browserToken),
      userId: ownedBy(params.userId),
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
    webOtpHost: string | null;
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
    await lockUntilCommit(manager, bucket);
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
