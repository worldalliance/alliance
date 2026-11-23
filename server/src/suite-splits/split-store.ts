import { MemberListMember } from "src/member-lists/entities/member-list-member.entity";
import { In, type EntityManager } from "typeorm";
import {
  SuiteSplitVersion,
  readSplitVersion,
  type ParsedSplitVersion,
} from "./entities/suite-split-version.entity";

export async function currentSplitVersion(
  manager: EntityManager,
  suiteId: number,
): Promise<ParsedSplitVersion | undefined> {
  const version = await manager.findOne(SuiteSplitVersion, {
    where: { suiteId },
    order: { id: "DESC" },
  });
  return version === null ? undefined : parseSplitVersion(version);
}

export function parseSplitVersion(
  version: SuiteSplitVersion,
): ParsedSplitVersion {
  const parsed = readSplitVersion(version);
  if (!parsed.ok) {
    throw new Error(`split version ${version.id} doesn't parse`, {
      cause: parsed.error,
    });
  }
  return parsed.value;
}

/** Members of each list version, by list id. */
export async function listMembers(
  manager: EntityManager,
  params: { listVersionIds: Map<string, number> },
): Promise<Map<string, Set<number>>> {
  const { listVersionIds } = params;
  const byList = new Map<string, Set<number>>(
    [...listVersionIds.keys()].map((listId) => [listId, new Set()]),
  );
  if (listVersionIds.size === 0) return byList;
  const listOf = new Map(
    [...listVersionIds].map(([listId, versionId]) => [versionId, listId]),
  );
  const rows = await manager.find(MemberListMember, {
    where: { versionId: In([...listVersionIds.values()]) },
  });
  for (const { versionId, userId } of rows) {
    const listId = listOf.get(versionId);
    if (listId !== undefined) byList.get(listId)?.add(userId);
  }
  return byList;
}
