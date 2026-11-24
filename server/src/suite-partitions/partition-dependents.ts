import type {
  Diagnostic,
  NamedExpression,
} from "@alliance/common/expression/catalog";
import {
  SaveProblemKind,
  type Dependent,
  type FixedDependent,
  type SaveProblem,
} from "@alliance/common/expression/named";
import type { Expr } from "@alliance/common/expression/tree";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { isEqual } from "es-toolkit";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { In, IsNull, type EntityManager } from "typeorm";
import type { ParsedPartitionVersion } from "./entities/suite-partition-version.entity";
import { SuitePartitionVersion } from "./entities/suite-partition-version.entity";
import { outsideReads, partRule, storedFallback } from "./partition-check";
import { PARTITION_CHANGED } from "./partition-messages";
import type { PartFallback } from "./partition-parts";
import { parsePartitionVersion } from "./partition-store";

/** A partition that hasn't gone live, whose parts formula saves must not break. */
export type DraftPartition = {
  suiteName: string;
  version: ParsedPartitionVersion;
};

/** A part condition fixed in a formula save, with the version it was fixed from. */
export type PartFix = {
  suiteId: number;
  baseVersionId: number;
  partId: string;
  text: string;
  fallback: PartFallback | null;
};

export type PartitionDependentLabel = {
  suiteId: number;
  suiteName: string;
  /** The partition version a fix starts from. */
  versionId: number;
  partId: string;
  partName: string;
  fallback: PartFallback | null;
};

const PREFIX = "partition:";

export const dependentId = (suiteId: number, partId: string) =>
  `${PREFIX}${suiteId}:${partId}`;

/**
 * Every partition whose suite hasn't gone live, that is, has no `member_action`
 * event at or before now, with its current version.
 */
export async function draftPartitions(
  manager: EntityManager,
): Promise<DraftPartition[]> {
  const versions = await manager
    .createQueryBuilder(SuitePartitionVersion, "version")
    .where(
      (query) =>
        `NOT EXISTS ${query
          .subQuery()
          .select("1")
          .from(ActionEvent, "event")
          .innerJoin("event.action", "action")
          .where('action."suiteId" = version."suiteId"')
          .andWhere('event."newStatus" = :status')
          .andWhere('event."date" <= now()')
          .andWhere('event."deletedAt" IS NULL')
          .getQuery()}`,
      { status: ActionStatus.MemberAction },
    )
    .distinctOn(["version.suiteId"])
    .orderBy("version.suiteId")
    .addOrderBy("version.id", "DESC")
    .getMany();
  if (versions.length === 0) return [];
  const suites = await manager.find(ActionSuite, {
    where: {
      id: In(versions.map((version) => version.suiteId)),
      deletedAt: IsNull(),
    },
  });
  return versions.flatMap((version) => {
    const suite = suites.find((each) => each.id === version.suiteId);
    return suite === undefined
      ? []
      : [{ suiteName: suite.name, version: parsePartitionVersion(version) }];
  });
}

/**
 * The part conditions of `partitions` as dependents of a formula save, each
 * fixed one with its admin's text and fallback. Throws `ConflictException`
 * when a fix started from a version that isn't current, and
 * `BadRequestException` for a fix of a part without a condition or a second
 * fix of one part.
 */
export function partitionDependents(
  partitions: readonly DraftPartition[],
  fixes: readonly PartFix[],
): Dependent[] {
  const fixed = new Set<string>();
  for (const fix of fixes) {
    const partition = partitions.find(
      ({ version }) => version.suiteId === fix.suiteId,
    );
    if (partition?.version.id !== fix.baseVersionId) {
      throw new ConflictException(PARTITION_CHANGED);
    }
    const part = partition.version.parts.find(({ id }) => id === fix.partId);
    if (part === undefined) throw new ConflictException(PARTITION_CHANGED);
    if (part.condition === null) {
      throw new BadRequestException(`"${part.name}" has no condition to fix.`);
    }
    const id = dependentId(fix.suiteId, fix.partId);
    if (fixed.has(id)) {
      throw new BadRequestException(`"${part.name}" is fixed twice.`);
    }
    fixed.add(id);
  }
  return partitions.flatMap(({ version }) =>
    version.parts.flatMap((part): Dependent[] => {
      if (part.condition === null) return [];
      const id = dependentId(version.suiteId, part.id);
      const fix = fixes.find(
        (each) => each.suiteId === version.suiteId && each.partId === part.id,
      );
      return fix === undefined
        ? [{ id, rule: partRule(part.fallback), stored: part.condition }]
        : [{ id, rule: partRule(fix.fallback), fixed: fix.text }];
    }),
  );
}

/**
 * Each part of `partitions` that would read something other than lists and
 * formulas once `named` and the fixes are saved.
 */
export function outsideReadProblems(params: {
  partitions: readonly DraftPartition[];
  named: readonly NamedExpression[];
  fixed: readonly FixedDependent[];
  print: (tree: Expr) => string;
}): SaveProblem[] {
  const { partitions, named, fixed, print } = params;
  return partitions.flatMap(({ version }) =>
    version.parts.flatMap((part): SaveProblem[] => {
      const id = dependentId(version.suiteId, part.id);
      const tree = fixed.find((each) => each.id === id)?.tree ?? part.condition;
      if (tree === null) return [];
      const message = outsideReads(tree, named);
      if (message === undefined) return [];
      const text = print(tree);
      const diagnostic: Diagnostic = { message, start: 0, end: text.length };
      return [
        {
          kind: SaveProblemKind.Dependent,
          id,
          text,
          diagnostics: [diagnostic],
        },
      ];
    }),
  );
}

/** Adds a partition version for each partition a fix changed. */
export async function writePartFixes(params: {
  manager: EntityManager;
  partitions: readonly DraftPartition[];
  fixes: readonly PartFix[];
  fixed: readonly FixedDependent[];
  savedById: number;
}): Promise<void> {
  const { manager, partitions, fixes, fixed, savedById } = params;
  for (const { version } of partitions) {
    const own = fixes.filter((fix) => fix.suiteId === version.suiteId);
    if (own.length === 0) continue;
    const parts = version.parts.map((part) => {
      const fix = own.find((each) => each.partId === part.id);
      if (fix === undefined) return part;
      const id = dependentId(version.suiteId, part.id);
      const checked = fixed.find((each) => each.id === id);
      if (checked === undefined) throw new Error(`fix ${id} wasn't checked`);
      return {
        ...part,
        condition: checked.tree,
        fallback: storedFallback({
          mayBeUnknown: checked.mayBeUnknown,
          fallback: fix.fallback,
        }),
      };
    });
    if (isEqual(parts, version.parts)) continue;
    await manager.insert(SuitePartitionVersion, {
      suiteId: version.suiteId,
      parts,
      savedById,
    });
  }
}

/** Names the part a dependent id refers to, for the admin. */
export function labelOf(
  partitions: readonly DraftPartition[],
  id: string,
): PartitionDependentLabel | undefined {
  if (!id.startsWith(PREFIX)) return undefined;
  for (const { suiteName, version } of partitions) {
    for (const part of version.parts) {
      if (dependentId(version.suiteId, part.id) === id) {
        return {
          suiteId: version.suiteId,
          suiteName,
          versionId: version.id,
          partId: part.id,
          partName: part.name,
          fallback: part.fallback,
        };
      }
    }
  }
  return undefined;
}
