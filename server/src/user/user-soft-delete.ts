import type { Relations } from "src/utils/Repository";
import type { EntityManager } from "typeorm";
import { OnetimeInvite } from "./entities/onetime-invite.entity";

/** Includes a deleted invite: deleting one keeps the referral and group
 * placement it made. */
export function findReferredByInvite(
  manager: EntityManager,
  params: { userId: number; relations?: Relations<OnetimeInvite> },
): Promise<OnetimeInvite | null> {
  // withDeleted after the relations' joins, which then still filter deleted
  // rows: TypeORM adds that filter to a join only while withDeleted is unset.
  return manager
    .createQueryBuilder(OnetimeInvite, "invite")
    .setFindOptions({
      where: { invitedUser: { id: params.userId } },
      relations: params.relations,
    })
    .withDeleted()
    .getOne();
}
