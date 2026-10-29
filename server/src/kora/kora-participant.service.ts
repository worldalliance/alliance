import { KoraError } from "@alliance/common/kora";
import { OAuthError, type OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type { Request, Response } from "express";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
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
import { KoraParticipantOAuthIdentity } from "./entities/kora-participant-oauth-identity.entity";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import {
  KORA_PARTICIPANT_NAME_MAX_LENGTH,
  KoraParticipant,
} from "./entities/kora-participant.entity";
import { clearCookie, KoraCookie } from "./kora-cookies";

const SIGNUP_TTL_MS = milliseconds({ minutes: 10 });

export type KoraSignInMethod = OtpChannel | OAuthProvider;

export type SignedIn = {
  participant: KoraParticipant;
  signedUp: boolean;
  method: KoraSignInMethod;
};

export type ContactVerified =
  | SignedIn
  | { signupToken: string; signupTtlMs: number };

type ProviderIdentity = { provider: OAuthProvider; subject: string };

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
 * Leaves a provider account another participant holds, or a second account
 * from the same provider, unconnected: the verified email still signs in.
 */
async function connect(
  manager: EntityManager,
  params: ProviderIdentity & { participantId: string; email: string },
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(KoraParticipantOAuthIdentity)
    .values(params)
    .orIgnore()
    .execute();
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
    identity: ProviderIdentity | null;
  },
): Promise<{ participant: KoraParticipant; signedUp: boolean }> {
  const inserted = await manager
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
    .returning(`"id"`)
    .execute();
  const participant = await manager.findOneByOrFail(
    KoraParticipant,
    contactWhere(params.contact),
  );
  if (params.identity) {
    await connect(manager, {
      ...params.identity,
      participantId: participant.id,
      email: params.contact.destination,
    });
  }
  return { participant, signedUp: inserted.raw.length > 0 };
}

@Injectable()
export class KoraParticipantService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraParticipant)
    private readonly participants: Repository<KoraParticipant>,
    @InjectRepository(KoraParticipantSignup)
    private readonly signups: Repository<KoraParticipantSignup>,
    @InjectRepository(KoraParticipantOAuthIdentity)
    private readonly identities: Repository<KoraParticipantOAuthIdentity>,
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
      return R.success({
        participant,
        signedUp: false,
        method: verified.value.channel,
      });
    }
    return R.success(
      await this.openSignup({ contact: verified.value, identity: null }),
    );
  }

  /**
   * The provider account it signed in with before, whatever its email says
   * now, or else the participant whose email it verified.
   */
  async verifyProvider(params: {
    profile: OAuthProfile;
    timeZone: string | null;
  }): Promise<Result<ContactVerified, OAuthError.EmailNotVerified>> {
    const { profile, timeZone } = params;
    if (!profile.emailVerified) {
      return R.failure(OAuthError.EmailNotVerified);
    }
    const identity: ProviderIdentity = {
      provider: profile.provider,
      subject: profile.subject,
    };
    const contact: OtpContact = {
      channel: OtpChannel.Email,
      destination: profile.email.trim(),
    };
    const [connected, byEmail] = await Promise.all([
      this.identities.findOne({
        where: identity,
        relations: { participant: true },
      }),
      this.participants.findOneBy(contactWhere(contact)),
    ]);

    if (connected?.participant) {
      if (connected.email !== contact.destination) {
        await this.identities.update(connected.id, {
          email: contact.destination,
        });
      }
      await this.fillTimeZone(connected.participant, timeZone);
      return R.success({
        participant: connected.participant,
        signedUp: false,
        method: profile.provider,
      });
    }
    if (byEmail) {
      await connect(this.dataSource.manager, {
        ...identity,
        participantId: byEmail.id,
        email: contact.destination,
      });
      await this.fillTimeZone(byEmail, timeZone);
      return R.success({
        participant: byEmail,
        signedUp: false,
        method: profile.provider,
      });
    }
    const name = profile.name
      ?.trim()
      .slice(0, KORA_PARTICIPANT_NAME_MAX_LENGTH);
    if (!name) {
      return R.success(await this.openSignup({ contact, identity }));
    }
    const created = await this.dataSource.transaction((manager) =>
      createParticipant(manager, {
        name,
        contact,
        timeZone,
        contactVerifiedAt: new Date(),
        identity,
      }),
    );
    return R.success({ ...created, method: profile.provider });
  }

  /**
   * Uses up the signup. When the contact already has a participant, as after
   * a concurrent signup, returns that participant with its name unchanged.
   */
  async completeSignup(params: {
    signupToken: string;
    name: string;
    timeZone: string | null;
  }): Promise<Result<SignedIn, KoraError.SignupExpired>> {
    return this.dataSource.transaction(async (manager) => {
      const consumed = await manager
        .createQueryBuilder()
        .delete()
        .from(KoraParticipantSignup)
        .where(`"tokenHash" = :tokenHash AND "expiresAt" > :now`, {
          tokenHash: hashToken(params.signupToken),
          now: new Date(),
        })
        .returning(
          `"channel", "destination", "provider", "subject", "createdAt"`,
        )
        .execute();
      const [signup]: Pick<
        KoraParticipantSignup,
        "channel" | "destination" | "provider" | "subject" | "createdAt"
      >[] = consumed.raw;
      if (!signup) {
        return R.failure(KoraError.SignupExpired);
      }
      const { provider, subject } = signup;
      const created = await createParticipant(manager, {
        name: params.name,
        contact: signup,
        timeZone: params.timeZone,
        contactVerifiedAt: signup.createdAt,
        identity: provider && subject ? { provider, subject } : null,
      });
      return R.success({ ...created, method: provider ?? signup.channel });
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

  private async openSignup(params: {
    contact: OtpContact;
    identity: ProviderIdentity | null;
  }): Promise<ContactVerified> {
    const signupToken = randomToken(32);
    await this.signups.insert({
      tokenHash: hashToken(signupToken),
      ...params.contact,
      provider: params.identity?.provider ?? null,
      subject: params.identity?.subject ?? null,
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
