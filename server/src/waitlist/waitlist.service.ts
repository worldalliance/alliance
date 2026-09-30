import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Campaign,
  TAKES_WAITLIST_ENTRIES,
} from "src/campaign/entities/campaign.entity";
import { randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { IsNull } from "typeorm";
import {
  CreateWaitlistEntryDto,
  WaitlistReferral,
  WaitlistReferralCodesDto,
} from "./dto/waitlist.dto";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";

export enum WaitlistEntryError {
  BothCodes = "both_codes",
  UnknownCode = "unknown_code",
  ReasonRequired = "reason_required",
}

export type NewWaitlistEntry = { id: number; code: string };

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
      ? await this.entryRepository.countBy({ organizationId: organization.id })
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

  /** Resolves to the new entry, or null for a known email. */
  async create(
    dto: CreateWaitlistEntryDto,
  ): Promise<Result<NewWaitlistEntry | null, WaitlistEntryError>> {
    const resolved = await this.resolveReferral(dto);
    if (R.isFailure(resolved)) {
      return resolved;
    }
    const { organization, sourceLinkId, referrer } = resolved.value;
    const reason = dto.reason ?? null;
    if (!organization && !reason) {
      return R.failure(WaitlistEntryError.ReasonRequired);
    }

    const code = randomToken(8);
    // ON CONFLICT rather than a caught unique violation: a failed query is
    // logged with its parameters, which here are the entrant's details.
    const inserted = await this.entryRepository
      .createQueryBuilder()
      .insert()
      .values({
        name: dto.name,
        email: dto.email,
        reason,
        committedAt: new Date(),
        code,
        organizationId: organization?.id ?? null,
        sourceLinkId,
        referrerId: referrer?.id ?? null,
      })
      .orIgnore()
      .returning("id")
      .execute();
    const [row] = inserted.raw;
    if (row) {
      return R.success({ id: row.id, code });
    }
    if (await this.entryRepository.existsBy({ email: dto.email })) {
      return R.success(null);
    }
    throw new Error("Waitlist entry insert conflicted on its personal code");
  }

  countWaiting(): Promise<number> {
    return this.entryRepository.countBy({ mobilizedAt: IsNull() });
  }
}
