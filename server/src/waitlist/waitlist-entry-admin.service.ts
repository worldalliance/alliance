import { looksLikePhoneNumber, phoneSearchTerm } from "@alliance/common/phone";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ContractEvent,
  compareContractEventsNewestFirst,
} from "src/user/entities/contract-event.entity";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import { inviteClaimableSql, inviteClaimedSql } from "src/user/invite-claim";
import type { Repository } from "src/utils/Repository";
import { Brackets, In, type SelectQueryBuilder } from "typeorm";
import {
  WaitlistContactMethod,
  type WaitlistEntryFilterDto,
  type WaitlistEntryPage,
  WaitlistEntrySearchDto,
  WaitlistEntrySort,
  WaitlistInviteState,
} from "./dto/waitlist-entry-admin.dto";
import { WaitlistEmailRecipientStatus } from "./entities/waitlist-email-recipient.entity";
import { WaitlistEntryActionKind } from "./entities/waitlist-entry-action.entity";
import {
  WaitlistEntry,
  WaitlistSpamStatus,
} from "./entities/waitlist-entry.entity";
import { recordEntryChange } from "./waitlist-entry-change";
import { recordMobilization } from "./waitlist-mobilization";
import { WaitlistTagService } from "./waitlist-tag.service";

const ENTRY_INVITE = `SELECT 1 FROM onetime_invite invite WHERE invite."waitlistEntryId" = entry.id`;

/** Whether an account claimed any invite of the entry aliased `entry`. */
export const ENTRY_INVITE_CLAIMED_SQL = `EXISTS (${ENTRY_INVITE} AND ${inviteClaimedSql("invite")})`;

const INVITE_STATE_SQL = `CASE
  WHEN ${ENTRY_INVITE_CLAIMED_SQL}
    THEN '${WaitlistInviteState.Claimed}'
  WHEN EXISTS (${ENTRY_INVITE} AND ${inviteClaimableSql("invite")})
    THEN '${WaitlistInviteState.Unused}'
  WHEN EXISTS (${ENTRY_INVITE})
    THEN '${WaitlistInviteState.Revoked}'
  ELSE '${WaitlistInviteState.None}'
END`;

const CONTACT_METHOD_SQL: Record<WaitlistContactMethod, string> = {
  [WaitlistContactMethod.Email]: "entry.email IS NOT NULL",
  [WaitlistContactMethod.Phone]: "entry.phoneNumber IS NOT NULL",
};

const escapeLike = (text: string): string => text.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class WaitlistEntryAdminService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
    private readonly tagService: WaitlistTagService,
  ) {}

  filtered(filter: WaitlistEntryFilterDto): SelectQueryBuilder<WaitlistEntry> {
    const query = this.entryRepository.createQueryBuilder("entry");
    if (filter.search) {
      const phoneTerm = looksLikePhoneNumber(filter.search)
        ? phoneSearchTerm(filter.search)
        : "";
      query.andWhere(
        new Brackets((search) => {
          search
            .where("entry.name ILIKE :search")
            .orWhere("entry.email ILIKE :search");
          if (phoneTerm) {
            search.orWhere("entry.phoneNumber LIKE :phoneTerm");
          }
        }),
        {
          search: `%${escapeLike(filter.search)}%`,
          phoneTerm: `%${phoneTerm}%`,
        },
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
    if (filter.tagIds?.length) {
      query.andWhere(
        `EXISTS (SELECT 1 FROM waitlist_entry_tag entry_tag WHERE entry_tag."entryId" = entry.id AND entry_tag."tagId" IN (:...tagIds))`,
        { tagIds: filter.tagIds },
      );
    }
    if (filter.inviteStates?.length) {
      query.andWhere(`(${INVITE_STATE_SQL}) IN (:...inviteStates)`, {
        inviteStates: filter.inviteStates,
      });
    }
    if (filter.spamStatuses?.length) {
      query.andWhere("entry.spamStatus IN (:...spamStatuses)", {
        spamStatuses: filter.spamStatuses,
      });
    }
    if (filter.contactMethod !== undefined) {
      query.andWhere(CONTACT_METHOD_SQL[filter.contactMethod]);
    }
    return query;
  }

  private async findInviteStates(
    ids: number[],
  ): Promise<Map<number, WaitlistInviteState>> {
    const rows = ids.length
      ? await this.entryRepository
          .createQueryBuilder("entry")
          .select("entry.id", "id")
          .addSelect(INVITE_STATE_SQL, "inviteState")
          .where("entry.id IN (:...ids)", { ids })
          .getRawMany<{ id: number; inviteState: WaitlistInviteState }>()
      : [];
    return new Map(rows.map((row) => [row.id, row.inviteState]));
  }

  private async findContractEvents(
    ids: number[],
  ): Promise<Map<number, ContractEvent[]>> {
    const invites = ids.length
      ? await this.entryRepository.manager
          .createQueryBuilder(OnetimeInvite, "invite")
          .setFindOptions({
            select: {
              id: true,
              waitlistEntryId: true,
              invitedUser: {
                id: true,
                contractEvents: {
                  id: true,
                  type: true,
                  date: true,
                  automatic: true,
                  contractId: true,
                },
              },
            },
            where: { waitlistEntryId: In(ids) },
            relations: { invitedUser: { contractEvents: true } },
          })
          // After setFindOptions, so deleted accounts and events stay filtered.
          .withDeleted()
          .getMany()
      : [];
    const eventsByEntry = new Map<number, ContractEvent[]>();
    for (const invite of invites) {
      if (invite.waitlistEntryId === null)
        throw new Error("waitlist invite has no entry");
      if (!invite.invitedUser) continue;
      if (!invite.invitedUser.contractEvents)
        throw new Error("contract events not loaded");
      const events = eventsByEntry.get(invite.waitlistEntryId) ?? [];
      events.push(...invite.invitedUser.contractEvents);
      eventsByEntry.set(invite.waitlistEntryId, events);
    }
    for (const events of eventsByEntry.values())
      events.sort(compareContractEventsNewestFirst);
    return eventsByEntry;
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
    const ids = entries.map((entry) => entry.id);
    const [stateById, tagsByEntry, eventsByEntry] = await Promise.all([
      this.findInviteStates(ids),
      this.tagService.findForEntries(ids),
      this.findContractEvents(ids),
    ]);

    return {
      entries: entries.map((entry) => {
        const inviteState = stateById.get(entry.id);
        if (inviteState === undefined) {
          throw new Error(`no invite state for waitlist entry ${entry.id}`);
        }
        return {
          entry,
          inviteState,
          tags: tagsByEntry.get(entry.id) ?? [],
          contractEvents: eventsByEntry.get(entry.id) ?? [],
        };
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

  /**
   * Revokes every invite of the entries that signup could still claim, except
   * one a waitlist email is sending right now. Resolves to how many it revoked.
   */
  revokeInvites(entryIds: number[]): Promise<number> {
    const claimable = `invite."waitlistEntryId" = ANY($1) AND ${inviteClaimableSql("invite")}`;
    return this.entryRepository.manager.transaction(async (manager) => {
      // Locking first makes the update run on a fresh snapshot, which sees a
      // signup claim or a recipient marked sending while this waited. Locking
      // in id order keeps overlapping revokes from deadlocking.
      await manager.query(
        `SELECT invite.id FROM onetime_invite invite WHERE ${claimable} ORDER BY invite.id FOR UPDATE`,
        [entryIds],
      );
      const [{ count }] = await manager.query(
        `WITH revoked AS (
           UPDATE onetime_invite invite SET "deletedAt" = now()
           WHERE ${claimable}
             AND NOT EXISTS (
               SELECT 1 FROM waitlist_email_recipient recipient
               WHERE recipient."inviteId" = invite.id AND recipient.status = $2
                 AND recipient."deletedAt" IS NULL
             )
           RETURNING invite.id
         )
         SELECT count(*)::int AS count FROM revoked`,
        [entryIds, WaitlistEmailRecipientStatus.Sending],
      );
      return count;
    });
  }

  setMobilized(params: {
    entryIds: number[];
    mobilized: boolean;
    staffUserId: number;
  }): Promise<number> {
    return recordMobilization({
      manager: this.entryRepository.manager,
      entryIds: params.entryIds,
      kind: params.mobilized
        ? WaitlistEntryActionKind.ManualMobilize
        : WaitlistEntryActionKind.UndoMobilize,
      staffUserId: params.staffUserId,
    });
  }

  /**
   * Unsubscribes the entries still subscribed, recording each change.
   * Resolves to how many changed.
   */
  async markUnsubscribed(params: {
    entryIds: number[];
    staffUserId: number;
  }): Promise<number> {
    return recordEntryChange({
      manager: this.entryRepository.manager,
      entryIds: params.entryIds,
      set: `"unsubscribedAt" = now()`,
      differs: `"unsubscribedAt" IS NULL`,
      kind: WaitlistEntryActionKind.MarkUnsubscribed,
      staffUserId: params.staffUserId,
    });
  }

  /**
   * Sets the staff ruling on the entries whose status differs, recording each
   * change. Resolves to how many changed.
   */
  async setSpam(params: {
    entryIds: number[];
    spam: boolean;
    staffUserId: number;
  }): Promise<number> {
    const [status, kind] = params.spam
      ? [WaitlistSpamStatus.Spam, WaitlistEntryActionKind.MarkSpam]
      : [WaitlistSpamStatus.NotSpam, WaitlistEntryActionKind.MarkNotSpam];
    return recordEntryChange({
      manager: this.entryRepository.manager,
      entryIds: params.entryIds,
      set: `"spamStatus" = $4`,
      differs: `"spamStatus" <> $4`,
      value: status,
      kind,
      staffUserId: params.staffUserId,
    });
  }
}
