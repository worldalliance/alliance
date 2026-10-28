import { ParticipantError } from "@alliance/common/participant";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import {
  type OtpContact,
  OtpService,
  type OtpVerifyRefusal,
} from "src/otp/otp.service";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import {
  DataSource,
  type FindOptionsWhere,
  IsNull,
  LessThan,
  MoreThan,
} from "typeorm";
import { ProjectParticipantSignup } from "./entities/project-participant-signup.entity";
import { ProjectParticipant } from "./entities/project-participant.entity";

const SIGNUP_TTL_MS = milliseconds({ minutes: 10 });

export type CodeVerified =
  | { participant: ProjectParticipant }
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

function contactWhere(
  contact: OtpContact,
): FindOptionsWhere<ProjectParticipant> {
  const { email, phoneNumber } = contactColumns(contact);
  return { email: email ?? IsNull(), phoneNumber: phoneNumber ?? IsNull() };
}

@Injectable()
export class ParticipantService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectParticipant)
    private readonly participants: Repository<ProjectParticipant>,
    @InjectRepository(ProjectParticipantSignup)
    private readonly signups: Repository<ProjectParticipantSignup>,
    private readonly otpService: OtpService,
  ) {}

  async verifyCode(params: {
    codeToken: string;
    code: string;
    ip: string;
    timeZone: string | null;
  }): Promise<Result<CodeVerified, OtpVerifyRefusal>> {
    const verified = await this.otpService.verify({
      purpose: OtpPurpose.ParticipantSignIn,
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
      if (params.timeZone !== null) {
        await this.participants.update(
          { id: participant.id, timeZone: IsNull() },
          { timeZone: params.timeZone },
        );
      }
      return R.success({ participant });
    }
    const signupToken = randomToken(32);
    await this.signups.insert({
      tokenHash: hashToken(signupToken),
      ...verified.value,
      expiresAt: new Date(Date.now() + SIGNUP_TTL_MS),
    });
    return R.success({ signupToken, signupTtlMs: SIGNUP_TTL_MS });
  }

  /**
   * Uses up the signup. When the contact already has a participant, as after
   * a concurrent signup, returns that participant with its name unchanged.
   */
  async completeSignup(params: {
    signupToken: string;
    name: string;
    timeZone: string | null;
  }): Promise<Result<ProjectParticipant, ParticipantError.SignupExpired>> {
    return this.dataSource.transaction(async (manager) => {
      const consumed = await manager
        .createQueryBuilder()
        .delete()
        .from(ProjectParticipantSignup)
        .where(`"tokenHash" = :tokenHash AND "expiresAt" > :now`, {
          tokenHash: hashToken(params.signupToken),
          now: new Date(),
        })
        .returning(`"channel", "destination", "createdAt"`)
        .execute();
      const [signup]: Pick<
        ProjectParticipantSignup,
        "channel" | "destination" | "createdAt"
      >[] = consumed.raw;
      if (!signup) {
        return R.failure(ParticipantError.SignupExpired);
      }
      await manager
        .createQueryBuilder()
        .insert()
        .into(ProjectParticipant)
        .values({
          name: params.name,
          ...contactColumns(signup),
          timeZone: params.timeZone,
          contactVerifiedAt: signup.createdAt,
        })
        .orIgnore()
        .execute();
      return R.success(
        await manager.findOneByOrFail(ProjectParticipant, contactWhere(signup)),
      );
    });
  }

  async signupPending(signupToken: string): Promise<boolean> {
    return this.signups.existsBy({
      tokenHash: hashToken(signupToken),
      expiresAt: MoreThan(new Date()),
    });
  }

  async abandonSignup(signupToken: string): Promise<void> {
    await this.signups.delete({ tokenHash: hashToken(signupToken) });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async forgetExpiredSignups(): Promise<void> {
    await this.signups.delete({ expiresAt: LessThan(new Date()) });
  }
}
