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
import type { ParsedSplitVersion } from "./entities/suite-split-version.entity";
import { SuiteSplitVersion } from "./entities/suite-split-version.entity";
import { groupRule, outsideReads, storedFallback } from "./split-check";
import type { GroupFallback } from "./split-groups";
import { SPLIT_CHANGED } from "./split-messages";
import { parseSplitVersion } from "./split-store";

/** A split that hasn't gone live, whose groups formula saves must not break. */
export type DraftSplit = { suiteName: string; version: ParsedSplitVersion };

/** A group condition fixed in a formula save, with the version it was fixed from. */
export type GroupFix = {
  suiteId: number;
  baseVersionId: number;
  groupId: string;
  text: string;
  fallback: GroupFallback | null;
};

export type SplitDependentLabel = {
  suiteId: number;
  suiteName: string;
  /** The split version a fix starts from. */
  versionId: number;
  groupId: string;
  groupName: string;
  fallback: GroupFallback | null;
};

const PREFIX = "split:";

export const dependentId = (suiteId: number, groupId: string) =>
  `${PREFIX}${suiteId}:${groupId}`;

/**
 * Every split whose suite hasn't gone live, that is, has no `member_action`
 * event at or before now, with its current version.
 */
export async function draftSplits(
  manager: EntityManager,
): Promise<DraftSplit[]> {
  const versions = await manager
    .createQueryBuilder(SuiteSplitVersion, "version")
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
      : [{ suiteName: suite.name, version: parseSplitVersion(version) }];
  });
}

/**
 * The group conditions of `splits` as dependents of a formula save, each
 * fixed one with its admin's text and fallback. Throws `ConflictException`
 * when a fix started from a version that isn't current, and
 * `BadRequestException` for a fix of a group without a condition or a second
 * fix of one group.
 */
export function splitDependents(
  splits: readonly DraftSplit[],
  fixes: readonly GroupFix[],
): Dependent[] {
  const fixed = new Set<string>();
  for (const fix of fixes) {
    const split = splits.find(({ version }) => version.suiteId === fix.suiteId);
    if (split?.version.id !== fix.baseVersionId) {
      throw new ConflictException(SPLIT_CHANGED);
    }
    const group = split.version.groups.find(({ id }) => id === fix.groupId);
    if (group === undefined) throw new ConflictException(SPLIT_CHANGED);
    if (group.condition === null) {
      throw new BadRequestException(`"${group.name}" has no condition to fix.`);
    }
    const id = dependentId(fix.suiteId, fix.groupId);
    if (fixed.has(id)) {
      throw new BadRequestException(`"${group.name}" is fixed twice.`);
    }
    fixed.add(id);
  }
  return splits.flatMap(({ version }) =>
    version.groups.flatMap((group): Dependent[] => {
      if (group.condition === null) return [];
      const id = dependentId(version.suiteId, group.id);
      const fix = fixes.find(
        (each) => each.suiteId === version.suiteId && each.groupId === group.id,
      );
      return fix === undefined
        ? [{ id, rule: groupRule(group.fallback), stored: group.condition }]
        : [{ id, rule: groupRule(fix.fallback), fixed: fix.text }];
    }),
  );
}

/**
 * Each group of `splits` that would read something other than lists and
 * formulas once `named` and the fixes are saved.
 */
export function outsideReadProblems(params: {
  splits: readonly DraftSplit[];
  named: readonly NamedExpression[];
  fixed: readonly FixedDependent[];
  print: (tree: Expr) => string;
}): SaveProblem[] {
  const { splits, named, fixed, print } = params;
  return splits.flatMap(({ version }) =>
    version.groups.flatMap((group): SaveProblem[] => {
      const id = dependentId(version.suiteId, group.id);
      const tree =
        fixed.find((each) => each.id === id)?.tree ?? group.condition;
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

/** Adds a split version for each split a fix changed. */
export async function writeGroupFixes(params: {
  manager: EntityManager;
  splits: readonly DraftSplit[];
  fixes: readonly GroupFix[];
  fixed: readonly FixedDependent[];
  savedById: number;
}): Promise<void> {
  const { manager, splits, fixes, fixed, savedById } = params;
  for (const { version } of splits) {
    const own = fixes.filter((fix) => fix.suiteId === version.suiteId);
    if (own.length === 0) continue;
    const groups = version.groups.map((group) => {
      const fix = own.find((each) => each.groupId === group.id);
      if (fix === undefined) return group;
      const id = dependentId(version.suiteId, group.id);
      const checked = fixed.find((each) => each.id === id);
      if (checked === undefined) throw new Error(`fix ${id} wasn't checked`);
      return {
        ...group,
        condition: checked.tree,
        fallback: storedFallback({
          mayBeUnknown: checked.mayBeUnknown,
          fallback: fix.fallback,
        }),
      };
    });
    if (isEqual(groups, version.groups)) continue;
    await manager.insert(SuiteSplitVersion, {
      suiteId: version.suiteId,
      groups,
      savedById,
    });
  }
}

/** Names the split group a dependent id refers to, for the admin. */
export function labelOf(
  splits: readonly DraftSplit[],
  id: string,
): SplitDependentLabel | undefined {
  if (!id.startsWith(PREFIX)) return undefined;
  for (const { suiteName, version } of splits) {
    for (const group of version.groups) {
      if (dependentId(version.suiteId, group.id) === id) {
        return {
          suiteId: version.suiteId,
          suiteName,
          versionId: version.id,
          groupId: group.id,
          groupName: group.name,
          fallback: group.fallback,
        };
      }
    }
  }
  return undefined;
}
