import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { inviteClaimableSql, inviteClaimedSql } from "src/user/invite-claim";
import type { Repository } from "src/utils/Repository";
import { Brackets, type SelectQueryBuilder } from "typeorm";
import {
  type WaitlistEntryFilterDto,
  type WaitlistEntryPage,
  WaitlistEntrySearchDto,
  WaitlistEntrySort,
  WaitlistInviteState,
} from "./dto/waitlist-entry-admin.dto";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";

const ENTRY_INVITE = `SELECT 1 FROM onetime_invite invite WHERE invite."waitlistEntryId" = entry.id`;

const INVITE_STATE_SQL = `CASE
  WHEN EXISTS (${ENTRY_INVITE} AND ${inviteClaimedSql("invite")})
    THEN '${WaitlistInviteState.Claimed}'
  WHEN EXISTS (${ENTRY_INVITE} AND ${inviteClaimableSql("invite")})
    THEN '${WaitlistInviteState.Unused}'
  WHEN EXISTS (${ENTRY_INVITE})
    THEN '${WaitlistInviteState.Revoked}'
  ELSE '${WaitlistInviteState.None}'
END`;

const escapeLike = (text: string): string => text.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class WaitlistEntryAdminService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
  ) {}

  private filtered(
    filter: WaitlistEntryFilterDto,
  ): SelectQueryBuilder<WaitlistEntry> {
    const query = this.entryRepository.createQueryBuilder("entry");
    if (filter.search) {
      query.andWhere(
        new Brackets((search) =>
          search
            .where("entry.name ILIKE :search")
            .orWhere("entry.email ILIKE :search"),
        ),
        { search: `%${escapeLike(filter.search)}%` },
      );
    }
    if (filter.organizationIds?.length) {
      query.andWhere("entry.organizationId IN (:...organizationIds)", {
        organizationIds: filter.organizationIds,
      });
    }
    if (filter.sourceLinkIds?.length) {
      query.andWhere("entry.sourceLinkId IN (:...sourceLinkIds)", {
        sourceLinkIds: filter.sourceLinkIds,
      });
    }
    if (filter.referrerIds?.length) {
      query.andWhere("entry.referrerId IN (:...referrerIds)", {
        referrerIds: filter.referrerIds,
      });
    }
    if (filter.joinedFrom) {
      query.andWhere("entry.createdAt >= :joinedFrom", {
        joinedFrom: filter.joinedFrom,
      });
    }
    if (filter.joinedBefore) {
      query.andWhere("entry.createdAt < :joinedBefore", {
        joinedBefore: filter.joinedBefore,
      });
    }
    if (filter.mobilized !== undefined) {
      query.andWhere(
        filter.mobilized
          ? "entry.mobilizedAt IS NOT NULL"
          : "entry.mobilizedAt IS NULL",
      );
    }
    if (filter.subscribed !== undefined) {
      query.andWhere(
        filter.subscribed
          ? "entry.unsubscribedAt IS NULL"
          : "entry.unsubscribedAt IS NOT NULL",
      );
    }
    if (filter.hasReason !== undefined) {
      query.andWhere(
        filter.hasReason ? "entry.reason IS NOT NULL" : "entry.reason IS NULL",
      );
    }
    if (filter.inviteStates?.length) {
      query.andWhere(`(${INVITE_STATE_SQL}) IN (:...inviteStates)`, {
        inviteStates: filter.inviteStates,
      });
    }
    return query;
  }

  async search(dto: WaitlistEntrySearchDto): Promise<WaitlistEntryPage> {
    const query = this.filtered(dto.filter)
      .leftJoinAndSelect("entry.organization", "organization")
      .leftJoinAndSelect("entry.sourceLink", "sourceLink")
      .leftJoinAndSelect("entry.referrer", "referrer")
      .skip(dto.offset)
      .take(dto.limit);
    switch (dto.sort) {
      case WaitlistEntrySort.JoinedDesc:
        query.orderBy("entry.createdAt", "DESC");
        break;
      case WaitlistEntrySort.JoinedAsc:
        query.orderBy("entry.createdAt", "ASC");
        break;
      case WaitlistEntrySort.OrganizationAsc:
        query
          .orderBy("organization.name", "ASC", "NULLS LAST")
          .addOrderBy("entry.createdAt", "DESC");
        break;
      case WaitlistEntrySort.OrganizationDesc:
        query
          .orderBy("organization.name", "DESC", "NULLS LAST")
          .addOrderBy("entry.createdAt", "DESC");
        break;
      default:
        throw new Error(`unknown sort: ${dto.sort satisfies never}`);
    }
    const [entries, total] = await query
      .addOrderBy("entry.id")
      .getManyAndCount();
    const states = entries.length
      ? await this.entryRepository
          .createQueryBuilder("entry")
          .select("entry.id", "id")
          .addSelect(INVITE_STATE_SQL, "inviteState")
          .where("entry.id IN (:...ids)", { ids: entries.map((e) => e.id) })
          .getRawMany<{ id: number; inviteState: WaitlistInviteState }>()
      : [];

    const stateById = new Map(states.map((row) => [row.id, row.inviteState]));
    return {
      entries: entries.map((entry) => {
        const inviteState = stateById.get(entry.id);
        if (inviteState === undefined) {
          throw new Error(`no invite state for waitlist entry ${entry.id}`);
        }
        return { entry, inviteState };
      }),
      total,
    };
  }

  async findIds(filter: WaitlistEntryFilterDto): Promise<number[]> {
    const rows = await this.filtered(filter)
      .select("entry.id", "id")
      .orderBy("entry.id")
      .getRawMany<{ id: number }>();
    return rows.map((row) => row.id);
  }
}
