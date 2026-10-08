import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Campaign,
  TAKES_WAITLIST_ENTRIES,
} from "src/campaign/entities/campaign.entity";
import { randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { In, IsNull, Not } from "typeorm";
import {
  CreateWaitlistEntryDto,
  WaitlistReferral,
  WaitlistReferralCodesDto,
} from "./dto/waitlist.dto";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";
import { detectSpamStatus, SPAM_LIKE_STATUSES } from "./waitlist-spam";

export enum WaitlistEntryError {
  BothCodes = "both_codes",
  OneContact = "one_contact",
  UnknownCode = "unknown_code",
}

export type NewWaitlistEntry = { id: number; code: string };

type WaitlistContact =
  | { email: string; phoneNumber: null }
  | { email: null; phoneNumber: string };

function contactOf({
  email,
  phoneNumber,
}: CreateWaitlistEntryDto): Result<WaitlistContact, WaitlistEntryError> {
  if (email !== undefined && phoneNumber === undefined) {
    return R.success({ email, phoneNumber: null });
  }
  if (phoneNumber !== undefined && email === undefined) {
    return R.success({ email: null, phoneNumber });
  }
  return R.failure(WaitlistEntryError.OneContact);
}

const NOT_SPAM_LIKE = { spamStatus: Not(In(SPAM_LIKE_STATUSES)) };

type ResolvedReferral = {
  organization: Campaign | null;
  sourceLinkId: number | null;
  referrer: WaitlistEntry | null;
};

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
    @InjectRepository(WaitlistLink)
    private readonly linkRepository: Repository<WaitlistLink>,
  ) {}

  private async resolveReferral({
    linkCode,
    referrerCode,
  }: WaitlistReferralCodesDto): Promise<
    Result<ResolvedReferral, WaitlistEntryError>
  > {
    if (linkCode !== undefined && referrerCode !== undefined) {
      return R.failure(WaitlistEntryError.BothCodes);
    }
    if (linkCode !== undefined) {
      const link = await this.linkRepository.findOne({
        where: { code: linkCode, archivedAt: IsNull() },
        relations: { organization: { community: true } },
      });
      if (
        !link?.organization ||
        !TAKES_WAITLIST_ENTRIES[link.organization.kind]
      ) {
        return R.failure(WaitlistEntryError.UnknownCode);
      }
      return R.success({
        organization: link.organization,
        sourceLinkId: link.id,
        referrer: null,
      });
    }
    if (referrerCode !== undefined) {
      const referrer = await this.entryRepository.findOne({
        where: { code: referrerCode },
        relations: { organization: { community: true } },
      });
      if (!referrer) {
        return R.failure(WaitlistEntryError.UnknownCode);
      }
      return R.success({
        organization: referrer.organization ?? null,
        sourceLinkId: referrer.sourceLinkId,
        referrer,
      });
    }
    return R.success({
      organization: null,
      sourceLinkId: null,
      referrer: null,
    });
  }

  async findReferral(
    codes: WaitlistReferralCodesDto,
  ): Promise<Result<WaitlistReferral, WaitlistEntryError>> {
    const resolved = await this.resolveReferral(codes);
    if (R.isFailure(resolved)) {
      return resolved;
    }
    const { organization, referrer } = resolved.value;
    const entryCount = organization
      ? await this.entryRepository.countBy({
          organizationId: organization.id,
          ...NOT_SPAM_LIKE,
        })
      : 0;
    return R.success({
      organization: organization && {
        name: organization.name,
        picture: organization.picture ?? organization.community?.photo ?? null,
        entryCount,
      },
      inviterName: referrer?.name ?? null,
    });
  }

  /** Resolves to the new entry, or null for a known contact. */
  async create(
    dto: CreateWaitlistEntryDto,
  ): Promise<Result<NewWaitlistEntry | null, WaitlistEntryError>> {
    const contact = contactOf(dto);
    if (R.isFailure(contact)) {
      return contact;
    }
    const resolved = await this.resolveReferral(dto);
    if (R.isFailure(resolved)) {
      return resolved;
    }
    const { organization, sourceLinkId, referrer } = resolved.value;
    const reason = dto.reason ?? null;
    const code = randomToken(8);
    // ON CONFLICT rather than a caught unique violation: a failed query is
    // logged with its parameters, which here are the entrant's details.
    const inserted = await this.entryRepository
      .createQueryBuilder()
      .insert()
      .values({
        name: dto.name,
        ...contact.value,
        reason,
        committedAt: new Date(),
        code,
        organizationId: organization?.id ?? null,
        sourceLinkId,
        referrerId: referrer?.id ?? null,
        spamStatus: detectSpamStatus(reason),
      })
      .orIgnore()
      .returning("id")
      .execute();
    const [row] = inserted.raw;
    if (row) {
      return R.success({ id: row.id, code });
    }
    const { email, phoneNumber } = contact.value;
    if (
      await this.entryRepository.existsBy(
        email !== null ? { email } : { phoneNumber },
      )
    ) {
      return R.success(null);
    }
    throw new Error("Waitlist entry insert conflicted on its personal code");
  }

  async unsubscribe(
    token: string,
  ): Promise<Result<void, WaitlistEntryError.UnknownCode>> {
    const entry = await this.entryRepository.findOneBy({
      unsubscribeToken: token,
    });
    if (!entry) {
      return R.failure(WaitlistEntryError.UnknownCode);
    }
    await this.entryRepository.update(
      { id: entry.id, unsubscribedAt: IsNull() },
      { unsubscribedAt: new Date() },
    );
    return R.success(undefined);
  }

  countWaiting(): Promise<number> {
    return this.entryRepository.countBy({
      mobilizedAt: IsNull(),
      ...NOT_SPAM_LIKE,
    });
  }
}
