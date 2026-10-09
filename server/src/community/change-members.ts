import type { EntityManager } from "typeorm";
import { Community } from "./entities/community.entity";

/**
 * Writes only the membership rows that change. Saving a loaded member list
 * instead would write back the rows of members deleted since the load. An
 * add a concurrent request already made is a no-op.
 */
export async function changeMembers(params: {
  manager: EntityManager;
  communityId: number;
  relation: "users" | "leaders";
  add?: number[];
  remove?: number[];
}): Promise<void> {
  const { manager, communityId, relation, add = [], remove = [] } = params;
  const junction = manager.connection
    .getMetadata(Community)
    .findRelationWithPropertyPath(relation)?.junctionEntityMetadata;
  const [communityColumn] = junction?.ownerColumns ?? [];
  const [userColumn] = junction?.inverseColumns ?? [];
  if (!junction || !communityColumn || !userColumn) {
    throw new Error(`Community.${relation} has no join table`);
  }
  if (add.length) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(junction.target)
      .values(
        add.map((userId) => ({
          [communityColumn.propertyName]: communityId,
          [userColumn.propertyName]: userId,
        })),
      )
      .orIgnore()
      .execute();
  }
  if (remove.length) {
    await manager
      .createQueryBuilder()
      .relation(Community, relation)
      .of(communityId)
      .remove(remove);
  }
}
