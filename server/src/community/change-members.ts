import type { EntityManager } from "typeorm";
import { z } from "zod";
import { Community } from "./entities/community.entity";

/**
 * Writes only the membership rows that change. Saving a loaded member list
 * instead would write back the rows of members deleted since the load. An
 * add a concurrent request already made is a no-op.
 *
 * @returns the ids this call added, leaving out those already members
 */
export async function changeMembers(params: {
  manager: EntityManager;
  communityId: number;
  relation: "users" | "leaders";
  add?: number[];
  remove?: number[];
}): Promise<number[]> {
  const { manager, communityId, relation, add = [], remove = [] } = params;
  const junction = manager.connection
    .getMetadata(Community)
    .findRelationWithPropertyPath(relation)?.junctionEntityMetadata;
  const [communityColumn] = junction?.ownerColumns ?? [];
  const [userColumn] = junction?.inverseColumns ?? [];
  if (!junction || !communityColumn || !userColumn) {
    throw new Error(`Community.${relation} has no join table`);
  }
  let added: number[] = [];
  if (add.length) {
    const { raw } = await manager
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
      .returning([userColumn.databaseName])
      .execute();
    added = z
      .array(z.object({ [userColumn.databaseName]: z.number() }))
      .parse(raw)
      .map((row) => row[userColumn.databaseName]);
  }
  if (remove.length) {
    await manager
      .createQueryBuilder()
      .relation(Community, relation)
      .of(communityId)
      .remove(remove);
  }
  return added;
}
