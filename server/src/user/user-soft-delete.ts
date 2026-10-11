import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import type { Relations } from "src/utils/Repository";
import type { EntityManager } from "typeorm";
import { OnetimeInvite } from "./entities/onetime-invite.entity";

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
