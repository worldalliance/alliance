import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import { writeUnderLive } from "src/datasources/soft-delete";
import type { Relations } from "src/utils/Repository";
import type { EntityManager } from "typeorm";
import { Friend } from "./entities/friend.entity";
import { OnetimeInvite } from "./entities/onetime-invite.entity";
import { User } from "./entities/user.entity";

export function saveFriendOfLiveUsers(
  manager: EntityManager,
  params: { rel: Friend; userIds: number[] },
): Promise<Friend> {
  const { rel, userIds } = params;
  return writeUnderLive(manager, {
    parents: userIds.map((id) => ({ target: User, id })),
    notFound: "User not found",
    write: (em) => em.save(Friend, rel),
  });
}

/** Includes a deleted invite: deleting one keeps the referral and group
 * placement it made. */
export function findReferredByInvite(
  manager: EntityManager,
  params: { userId: number; relations?: Relations<OnetimeInvite> },
): Promise<OnetimeInvite | null> {
  return findWithDeletedRoot(manager, {
    target: OnetimeInvite,
    options: {
      where: { invitedUser: { id: params.userId } },
      relations: params.relations,
    },
  }).getOne();
}
