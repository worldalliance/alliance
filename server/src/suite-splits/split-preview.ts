import { branches } from "@alliance/common/expression/branches";
import type { Scope } from "@alliance/common/expression/catalog";
import { printNames } from "@alliance/common/expression/check";
import { reads } from "@alliance/common/expression/dependencies";
import { printExpression } from "@alliance/common/expression/print";
import type { Expr } from "@alliance/common/expression/tree";
import { GroupWork } from "@alliance/common/suite-split";
import { countBy } from "es-toolkit";
import { workOf, type SplitGroup } from "./split-groups";
import { ResolutionKind, resolveGroup } from "./split-resolve";

export type SplitPreview = {
  population: number;
  groups: { groupId: string; count: number }[];
  byWork: Record<GroupWork, number>;
  couldNotDecide: number;
  /** Each error some member's evaluation hit, with how many hit it. */
  errors: { message: string; count: number }[];
  /** Each `?:` branch and `??` fallback no member's evaluation took. */
  untakenBranches: { where: string; text: string }[];
};

/**
 * Places every member of `userIds` as go-live would, against `scope` and the
 * list memberships in `members`, and counts the outcome.
 */
export function previewSplit(params: {
  groups: readonly SplitGroup[];
  scope: Scope;
  actionIds: readonly number[];
  userIds: readonly number[];
  members: ReadonlyMap<string, ReadonlySet<number>>;
}): SplitPreview {
  const { groups, scope, actionIds, userIds, members } = params;
  const taken = new Set<Expr>();
  const placed: string[] = [];
  const errors: string[] = [];
  for (const userId of userIds) {
    const resolution = resolveGroup({
      groups,
      scope,
      isOnList: (listId) => members.get(listId)?.has(userId) ?? false,
      onBranch: (node) => taken.add(node),
    });
    switch (resolution.kind) {
      case ResolutionKind.Placed:
        placed.push(resolution.groupId);
        break;
      case ResolutionKind.CouldNotDecide:
        errors.push(resolution.message);
        break;
      default:
        throw new Error(`unknown resolution: ${resolution satisfies never}`);
    }
  }
  const counts = countBy(placed, (groupId) => groupId);
  const byWork: Record<GroupWork, number> = {
    [GroupWork.Required]: 0,
    [GroupWork.OptionalOnly]: 0,
    [GroupWork.Nothing]: 0,
  };
  for (const group of groups) {
    byWork[workOf(group, actionIds)] += counts[group.id] ?? 0;
  }
  return {
    population: userIds.length,
    groups: groups.map((group) => ({
      groupId: group.id,
      count: counts[group.id] ?? 0,
    })),
    byWork,
    couldNotDecide: errors.length,
    errors: Object.entries(countBy(errors, (message) => message)).map(
      ([message, count]) => ({ message, count }),
    ),
    untakenBranches: untaken({ groups, scope, taken }),
  };
}

function untaken({
  groups,
  scope,
  taken,
}: {
  groups: readonly SplitGroup[];
  scope: Scope;
  taken: ReadonlySet<Expr>;
}): { where: string; text: string }[] {
  const names = printNames({ scope });
  const sources: { where: string; tree: Expr }[] = groups.flatMap((group) =>
    group.condition === null
      ? []
      : [{ where: group.name, tree: group.condition }],
  );
  const readIds = new Set(
    sources.flatMap(({ tree }) => [...reads(tree, scope.named).named]),
  );
  for (const each of scope.named) {
    if (readIds.has(each.id))
      sources.push({ where: each.name, tree: each.tree });
  }
  return sources.flatMap(({ where, tree }) =>
    branches(tree)
      .filter((branch) => !taken.has(branch))
      .map((branch) => ({ where, text: printExpression(branch, names) })),
  );
}
