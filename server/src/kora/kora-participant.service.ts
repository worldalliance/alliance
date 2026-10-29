import { KoraError } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type { Request, Response } from "express";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import {
  type OtpContact,
  OtpService,
  type OtpVerifyRefusal,
} from "src/otp/otp.service";
import { readCookie } from "src/utils/cookies";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import {
  DataSource,
  type EntityManager,
  type FindOptionsWhere,
  IsNull,
  LessThan,
  MoreThan,
} from "typeorm";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { clearCookie, KoraCookie } from "./kora-cookies";

const SIGNUP_TTL_MS = milliseconds({ minutes: 10 });

export type ContactVerified =
  | { participant: KoraParticipant }
  | { signupToken: string; signupTtlMs: number };

function contactColumns(contact: OtpContact): {
  email: string | null;
  phoneNumber: string | null;
} {
  switch (contact.channel) {
    case OtpChannel.Email:
      return { email: contact.destination, phoneNumber: null };
    case OtpChannel.Sms:
      return { email: null, phoneNumber: contact.destination };
    default:
      throw new Error(`unknown channel: ${contact.channel satisfies never}`);
  }
}

function contactWhere(contact: OtpContact): FindOptionsWhere<KoraParticipant> {
  const { email, phoneNumber } = contactColumns(contact);
  return { email: email ?? IsNull(), phoneNumber: phoneNumber ?? IsNull() };
}

/**
 * When the contact already has a participant, as after a concurrent signup,
 * returns that participant with its name unchanged.
 */
async function createParticipant(
  manager: EntityManager,
  params: {
    name: string;
    contact: OtpContact;
    timeZone: string | null;
    contactVerifiedAt: Date;
  },
): Promise<KoraParticipant> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(KoraParticipant)
    .values({
      name: params.name,
      ...contactColumns(params.contact),
      timeZone: params.timeZone,
      contactVerifiedAt: params.contactVerifiedAt,
    })
    .orIgnore()
    .execute();
  return manager.findOneByOrFail(KoraParticipant, contactWhere(params.contact));
}

@Injectable()
export class KoraParticipantService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraParticipant)
    private readonly participants: Repository<KoraParticipant>,
    @InjectRepository(KoraParticipantSignup)
    private readonly signups: Repository<KoraParticipantSignup>,
    private readonly otpService: OtpService,
  ) {}

  async verifyCode(params: {
    codeToken: string;
    code: string;
    ip: string;
    timeZone: string | null;
  }): Promise<Result<ContactVerified, OtpVerifyRefusal>> {
    const verified = await this.otpService.verify({
      purpose: OtpPurpose.KoraSignIn,
      browserToken: params.codeToken,
      code: params.code,
      ip: params.ip,
    });
    if (!verified.ok) {
      return verified;
    }
    const participant = await this.participants.findOneBy(
      contactWhere(verified.value),
    );
    if (participant) {
      await this.fillTimeZone(participant, params.timeZone);
      return R.success({ participant });
    }
    return R.success(await this.openSignup(verified.value));
  }

  /**
   * Uses up the signup. When the contact already has a participant, as after
   * a concurrent signup, returns that participant with its name unchanged.
   */
  async completeSignup(params: {
    signupToken: string;
    name: string;
    timeZone: string | null;
  }): Promise<Result<KoraParticipant, KoraError.SignupExpired>> {
    return this.dataSource.transaction(async (manager) => {
      const consumed = await manager
        .createQueryBuilder()
        .delete()
        .from(KoraParticipantSignup)
        .where(`"tokenHash" = :tokenHash AND "expiresAt" > :now`, {
          tokenHash: hashToken(params.signupToken),
          now: new Date(),
        })
        .returning(`"channel", "destination", "createdAt"`)
        .execute();
      const [signup]: Pick<
        KoraParticipantSignup,
        "channel" | "destination" | "createdAt"
      >[] = consumed.raw;
      if (!signup) {
        return R.failure(KoraError.SignupExpired);
      }
      const participant = await createParticipant(manager, {
        name: params.name,
        contact: signup,
        timeZone: params.timeZone,
        contactVerifiedAt: signup.createdAt,
      });
      return R.success(participant);
    });
  }

  async signupPending(signupToken: string): Promise<boolean> {
    return this.signups.existsBy({
      tokenHash: hashToken(signupToken),
      expiresAt: MoreThan(new Date()),
    });
  }

  async forgetCode(req: Request, res: Response): Promise<void> {
    const codeToken = readCookie(req, KoraCookie.Code);
    if (codeToken) {
      await this.otpService.abandon({
        purpose: OtpPurpose.KoraSignIn,
        browserToken: codeToken,
      });
    }
    clearCookie(res, KoraCookie.Code);
  }

  async forgetSignup(req: Request, res: Response): Promise<void> {
    const signupToken = readCookie(req, KoraCookie.Signup);
    if (signupToken) {
      await this.signups.delete({ tokenHash: hashToken(signupToken) });
    }
    clearCookie(res, KoraCookie.Signup);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async forgetExpiredSignups(): Promise<void> {
    await this.signups.delete({ expiresAt: LessThan(new Date()) });
  }

  private async openSignup(contact: OtpContact): Promise<ContactVerified> {
    const signupToken = randomToken(32);
    await this.signups.insert({
      tokenHash: hashToken(signupToken),
      ...contact,
      expiresAt: new Date(Date.now() + SIGNUP_TTL_MS),
    });
    return { signupToken, signupTtlMs: SIGNUP_TTL_MS };
  }

  private async fillTimeZone(
    participant: KoraParticipant,
    timeZone: string | null,
  ): Promise<void> {
    if (timeZone !== null) {
      await this.participants.update(
        { id: participant.id, timeZone: IsNull() },
        { timeZone },
      );
    }
  }
}
