import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import { writeUnderLive } from "src/datasources/soft-delete";
import type { Relations } from "src/utils/Repository";
import type { EntityManager } from "typeorm";
import { Friend } from "./entities/friend.entity";
import { OnetimeInvite } from "./entities/onetime-invite.entity";
import { User } from "./entities/user.entity";

/** A loaded friendship is saved only while it is still live, since its
 * save would otherwise undo a deletion committed since the load. */
export function saveFriendOfLiveUsers(
  manager: EntityManager,
  params: { rel: Friend; userIds: number[]; notFound: string },
): Promise<Friend> {
  const { rel, userIds, notFound } = params;
  return writeUnderLive(manager, {
    parents: userIds.map((id) => ({ target: User, id })),
    notFound: "User not found",
    saved:
      rel.id === undefined
        ? undefined
        : { target: Friend, id: rel.id, notFound },
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
