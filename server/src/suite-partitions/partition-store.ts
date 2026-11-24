import type {
  MemberListName,
  NamedExpression,
  Scope,
} from "@alliance/common/expression/catalog";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import {
  FormulaVersion,
  parseFormulaVersion,
} from "src/formulas/entities/formula-version.entity";
import { catalogWith } from "src/formulas/formula-catalog";
import { MemberListMember } from "src/member-lists/entities/member-list-member.entity";
import { MemberListVersion } from "src/member-lists/entities/member-list-version.entity";
import { Any, In, LessThanOrEqual, type EntityManager } from "typeorm";
import type { SuitePartitionPin } from "./entities/suite-partition-pin.entity";
import {
  SuitePartitionVersion,
  readPartitionVersion,
  type ParsedPartitionVersion,
} from "./entities/suite-partition-version.entity";

export async function currentPartitionVersion(
  manager: EntityManager,
  suiteId: number,
): Promise<ParsedPartitionVersion | undefined> {
  const version = await manager.findOne(SuitePartitionVersion, {
    where: { suiteId },
    order: { id: "DESC" },
  });
  return version === null ? undefined : parsePartitionVersion(version);
}

export function parsePartitionVersion(
  version: SuitePartitionVersion,
): ParsedPartitionVersion {
  const parsed = readPartitionVersion(version);
  if (!parsed.ok) {
    throw new Error(`partition version ${version.id} doesn't parse`, {
      cause: parsed.error,
    });
  }
  return parsed.value;
}

/**
 * When the suite went live: its earliest `member_action` event across its
 * actions, the time `draftPartitions` stops treating it as a draft.
 */
export async function suiteGoLive(
  manager: EntityManager,
  suiteId: number,
): Promise<Date> {
  const row = await manager
    .createQueryBuilder(ActionEvent, "event")
    .innerJoin("event.action", "action")
    .select("MIN(event.date)", "goLive")
    .where('action."suiteId" = :suiteId', { suiteId })
    .andWhere('event."newStatus" = :status', {
      status: ActionStatus.MemberAction,
    })
    .getRawOne<{ goLive: Date | null }>();
  if (!row?.goLive) throw new Error(`suite ${suiteId} hasn't gone live`);
  return row.goLive;
}

/** The suite's latest partition version saved by `at`. */
export async function partitionVersionAt(
  manager: EntityManager,
  params: { suiteId: number; at: Date },
): Promise<ParsedPartitionVersion | undefined> {
  const version = await manager.findOne(SuitePartitionVersion, {
    where: { suiteId: params.suiteId, createdAt: LessThanOrEqual(params.at) },
    order: { id: "DESC" },
  });
  return version === null ? undefined : parsePartitionVersion(version);
}

/** What expressions could read at `at`, with each version's id. */
export type VersionsAt = {
  named: (NamedExpression & { versionId: number })[];
  lists: (MemberListName & { versionId: number })[];
};

/**
 * Each formula's and member list's latest version saved by `at`, of those
 * not deleted by then.
 */
export async function versionsAt(
  manager: EntityManager,
  at: Date,
): Promise<VersionsAt> {
  const formulas = await manager
    .createQueryBuilder(FormulaVersion, "version")
    .innerJoinAndSelect("version.formula", "formula")
    .withDeleted()
    .where('version."createdAt" <= :at', { at })
    .andWhere('(formula."deletedAt" IS NULL OR formula."deletedAt" > :at)', {
      at,
    })
    .distinctOn(["version.formulaId"])
    .orderBy("version.formulaId")
    .addOrderBy("version.id", "DESC")
    .getMany();
  const lists = await manager
    .createQueryBuilder(MemberListVersion, "version")
    .innerJoinAndSelect("version.list", "list")
    .withDeleted()
    .where('version."createdAt" <= :at', { at })
    .andWhere('(list."deletedAt" IS NULL OR list."deletedAt" > :at)', { at })
    .distinctOn(["version.listId"])
    .orderBy("version.listId")
    .addOrderBy("version.id", "DESC")
    .getMany();
  return {
    named: formulas.map((version) => {
      const { formulaId, name, tree, id } = parseFormulaVersion(version);
      return { id: formulaId, name, tree, versionId: id };
    }),
    lists: lists.flatMap(({ id, list }) =>
      list === undefined
        ? []
        : [{ id: list.id, name: list.name, versionId: id }],
    ),
  };
}

/** The scope a pin evaluates in: its formula versions and list names. */
export async function pinnedScope(
  manager: EntityManager,
  pin: Pick<SuitePartitionPin, "formulaVersionIds" | "listVersionIds">,
): Promise<{ scope: Scope; listVersionIds: Map<string, number> }> {
  const [formulas, lists] = await Promise.all([
    pin.formulaVersionIds.length === 0
      ? Promise.resolve<FormulaVersion[]>([])
      : manager.find(FormulaVersion, {
          where: { id: In(pin.formulaVersionIds) },
        }),
    pin.listVersionIds.length === 0
      ? Promise.resolve<MemberListVersion[]>([])
      : manager.find(MemberListVersion, {
          where: { id: In(pin.listVersionIds) },
          relations: { list: true },
          withDeleted: true,
        }),
  ]);
  return {
    scope: {
      catalog: catalogWith(
        lists.flatMap(({ list }) => (list === undefined ? [] : [list])),
      ),
      named: formulas.map((version) => {
        const { formulaId, name, tree } = parseFormulaVersion(version);
        return { id: formulaId, name, tree };
      }),
    },
    listVersionIds: new Map(lists.map(({ id, listId }) => [listId, id])),
  };
}

/** Members of each list version, by list id, among `userIds` when given. */
export async function listMembers(
  manager: EntityManager,
  params: { listVersionIds: Map<string, number>; userIds?: number[] },
): Promise<Map<string, Set<number>>> {
  const { listVersionIds, userIds } = params;
  const byList = new Map<string, Set<number>>(
    [...listVersionIds.keys()].map((listId) => [listId, new Set()]),
  );
  if (listVersionIds.size === 0 || userIds?.length === 0) return byList;
  const listOf = new Map(
    [...listVersionIds].map(([listId, versionId]) => [versionId, listId]),
  );
  const rows = await manager.find(MemberListMember, {
    where: {
      versionId: In([...listVersionIds.values()]),
      ...(userIds === undefined ? {} : { userId: Any(userIds) }),
    },
  });
  for (const { versionId, userId } of rows) {
    const listId = listOf.get(versionId);
    if (listId !== undefined) byList.get(listId)?.add(userId);
  }
  return byList;
}
