import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { isAtCapacity } from "src/community/community.utils";
import { Community } from "src/community/entities/community.entity";
import { InviteFeedEvents } from "src/invite-feed.events";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { inviteClaimableSql } from "src/user/invite-claim";
import { randomToken } from "src/utils/random";
import { DataSource, type EntityManager, In, IsNull, Not } from "typeorm";
import {
  type WaitlistEntryInvite,
  WaitlistInvitePlacement,
} from "./dto/waitlist-entry-admin.dto";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";

type IssuedInvite = { invite: OnetimeInvite; issued: boolean };

export async function findFullCommunityIds(
  manager: EntityManager,
  communityIds: Set<number>,
): Promise<Set<number>> {
  if (!communityIds.size) return new Set();
  const communities = await manager.getRepository(Community).find({
    select: {
      id: true,
      maxCapacity: true,
      users: { id: true },
      leaders: { id: true },
    },
    where: { id: In([...communityIds]), maxCapacity: Not(IsNull()) },
    relations: { users: true, leaders: true },
  });
  return new Set(
    communities.filter(isAtCapacity).map((community) => community.id),
  );
}

export function invitePlacement(
  target: { organizationId: number | null; communityId: number | null },
  fullCommunityIds: Set<number>,
): WaitlistInvitePlacement {
  if (target.organizationId === null) {
    return WaitlistInvitePlacement.NoOrganization;
  }
  if (target.communityId === null) return WaitlistInvitePlacement.NoGroup;
  return fullCommunityIds.has(target.communityId)
    ? WaitlistInvitePlacement.FullGroup
    : WaitlistInvitePlacement.Group;
}

@Injectable()
export class WaitlistInviteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Reuses the entry's claimable invite, else issues one to its group. Needs
   * the entry's organization loaded. Locking the entry makes concurrent
   * callers for it reuse one invite rather than each issuing their own.
   */
  async inviteFor(
    manager: EntityManager,
    entry: WaitlistEntry,
  ): Promise<IssuedInvite> {
    await manager.query(
      "SELECT 1 FROM waitlist_entry WHERE id = $1 FOR NO KEY UPDATE",
      [entry.id],
    );
    const reusable = await manager
      .createQueryBuilder(OnetimeInvite, "invite")
      .where('invite."waitlistEntryId" = :entryId', { entryId: entry.id })
      .andWhere(inviteClaimableSql("invite"))
      .orderBy("invite.id", "DESC")
      .limit(1)
      // Holds a revoke off until the caller commits; after that, a revoke spares
      // the invite only if the caller recorded its recipient as Sending.
      .setLock("pessimistic_read")
      .getOne();
    if (reusable) return { invite: reusable, issued: false };
    const communityId = entry.organization?.communityId ?? null;
    const community = communityId === null ? null : { id: communityId };
    const invite = await manager.save(
      manager.create(OnetimeInvite, {
        invitee: entry.name,
        code: randomToken(9),
        status: OnetimeInviteStatus.LINK_UNUSED,
        invitingUser: null,
        organizationId: entry.organizationId,
        waitlistEntryId: entry.id,
        community,
      }),
    );
    return { invite, issued: true };
  }

  /** Sends nothing and leaves mobilization alone. */
  async issueForEntry(entryId: number): Promise<WaitlistEntryInvite> {
    const result = await this.dataSource.transaction(async (manager) => {
      const entry = await manager.findOne(WaitlistEntry, {
        where: { id: entryId },
        relations: { organization: true },
      });
      if (!entry) {
        throw new NotFoundException("Waitlist entry not found");
      }
      const issued = await this.inviteFor(manager, entry);
      // Signup places by the invite's group, which a reused invite fixed when
      // it was issued.
      const { communityId } = issued.invite;
      const full = await findFullCommunityIds(
        manager,
        new Set(communityId === null ? [] : [communityId]),
      );
      return { ...issued, placement: invitePlacement(issued.invite, full) };
    });
    if (result.issued) this.eventEmitter.emit(InviteFeedEvents.Created);
    return {
      code: result.invite.code,
      issued: result.issued,
      placement: result.placement,
    };
  }
}
