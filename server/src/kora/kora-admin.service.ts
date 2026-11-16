import type { OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { OtpChannel } from "src/otp/otp-copy";
import type { Repository } from "src/utils/Repository";
import { DataSource } from "typeorm";
import type {
  KoraAdminAbandonedSignup,
  KoraAdminOverview,
} from "./dto/kora-admin.dto";
import { KoraAbandonedSignup } from "./entities/kora-abandoned-signup.entity";
import { KoraParticipantOAuthIdentity } from "./entities/kora-participant-oauth-identity.entity";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import {
  KoraParticipant,
  participantContact,
} from "./entities/kora-participant.entity";

export enum KoraAdminError {
  NotFound = "not_found",
}

/** Emails compare case-insensitively, as their citext columns do. */
function contactKey(channel: OtpChannel, destination: string): string {
  switch (channel) {
    case OtpChannel.Email:
      return `${channel}:${destination.toLowerCase()}`;
    case OtpChannel.Sms:
      return `${channel}:${destination}`;
    default:
      throw new Error(`unknown channel: ${channel satisfies never}`);
  }
}

function markRecovered(
  participants: KoraParticipant[],
  signups: KoraAbandonedSignup[],
): KoraAdminAbandonedSignup[] {
  const contacts = new Set(
    participants.map((participant) => {
      const { channel, destination } = participantContact(participant);
      return contactKey(channel, destination);
    }),
  );
  return signups.map((signup) => ({
    signup,
    recovered: contacts.has(contactKey(signup.channel, signup.destination)),
  }));
}

@Injectable()
export class KoraAdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraParticipant)
    private readonly participants: Repository<KoraParticipant>,
    @InjectRepository(KoraParticipantOAuthIdentity)
    private readonly identities: Repository<KoraParticipantOAuthIdentity>,
    @InjectRepository(KoraAbandonedSignup)
    private readonly abandoned: Repository<KoraAbandonedSignup>,
  ) {}

  async overview(): Promise<KoraAdminOverview> {
    const [participants, identities, abandoned] = await Promise.all([
      this.participants.find({ order: { createdAt: "DESC" } }),
      this.identities.find({
        select: { participantId: true, provider: true },
        order: { provider: "ASC" },
      }),
      this.abandoned.find({ order: { verifiedAt: "DESC" } }),
    ]);
    const providers = new Map<string, OAuthProvider[]>();
    for (const identity of identities) {
      providers.set(identity.participantId, [
        ...(providers.get(identity.participantId) ?? []),
        identity.provider,
      ]);
    }
    return {
      participants: participants.map((participant) => ({
        participant,
        providers: providers.get(participant.id) ?? [],
      })),
      abandonedSignups: markRecovered(participants, abandoned),
    };
  }

  /**
   * Also deletes the contact's abandoned record and pending signups, since a
   * pending signup that ended later would record the contact again.
   */
  async deleteParticipant(
    id: string,
  ): Promise<Result<void, KoraAdminError.NotFound>> {
    return this.dataSource.transaction(async (manager) => {
      const participant = await manager.findOneBy(KoraParticipant, { id });
      if (!participant) {
        return R.failure(KoraAdminError.NotFound);
      }
      const contact = participantContact(participant);
      await manager.delete(KoraParticipantSignup, contact);
      await manager.delete(KoraAbandonedSignup, contact);
      await manager.delete(KoraParticipant, { id });
      return R.success(undefined);
    });
  }

  /** Also deletes the contact's pending signups, as `deleteParticipant` does. */
  async deleteAbandonedSignup(
    id: string,
  ): Promise<Result<void, KoraAdminError.NotFound>> {
    return this.dataSource.transaction(async (manager) => {
      const abandoned = await manager.findOneBy(KoraAbandonedSignup, { id });
      if (!abandoned) {
        return R.failure(KoraAdminError.NotFound);
      }
      const { channel, destination } = abandoned;
      await manager.delete(KoraParticipantSignup, { channel, destination });
      await manager.delete(KoraAbandonedSignup, { id });
      return R.success(undefined);
    });
  }
}
