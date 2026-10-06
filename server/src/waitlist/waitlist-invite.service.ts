import { Injectable } from "@nestjs/common";
import { isAtCapacity } from "src/community/community.utils";
import { Community } from "src/community/entities/community.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { inviteClaimableSql } from "src/user/invite-claim";
import { randomToken } from "src/utils/random";
import { type EntityManager, In, IsNull, Not } from "typeorm";
import type { WaitlistEntry } from "./entities/waitlist-entry.entity";

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

@Injectable()
export class WaitlistInviteService {
  /**
   * Reuses the entry's claimable invite, else issues one to its group. Needs
   * the entry's organization loaded.
   */
  async inviteFor(
    manager: EntityManager,
    entry: WaitlistEntry,
  ): Promise<IssuedInvite> {
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
}
