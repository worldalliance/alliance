import type { MemberListName } from "@alliance/common/expression/catalog";
import type { EntityManager } from "typeorm";
import { MemberListVersion } from "./entities/member-list-version.entity";
import { MemberList } from "./entities/member-list.entity";

export const LIST_CHANGED =
  "This list changed since you opened it. Reload to see the changes.";

/**
 * Every list that isn't deleted, or only the one with `id`, with its latest
 * version's id, by name.
 */
export async function currentLists(
  manager: EntityManager,
  id?: string,
): Promise<(MemberListName & { versionId: number })[]> {
  const query = manager
    .createQueryBuilder(MemberListVersion, "version")
    .innerJoinAndSelect("version.list", "list");
  if (id !== undefined) query.where("version.listId = :id", { id });
  const versions = await query
    .distinctOn(["version.listId"])
    .orderBy("version.listId")
    .addOrderBy("version.id", "DESC")
    .getMany();
  return versions
    .flatMap(({ id, list }) =>
      list === undefined
        ? []
        : [{ id: list.id, name: list.name, versionId: id }],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Names of deleted lists, by id, so old formula versions still print. */
export async function deletedListNames(
  manager: EntityManager,
): Promise<Map<string, string>> {
  const deleted = await manager
    .createQueryBuilder(MemberList, "list")
    .withDeleted()
    .where('list."deletedAt" IS NOT NULL')
    .getMany();
  return new Map(deleted.map(({ id, name }) => [id, name]));
}
