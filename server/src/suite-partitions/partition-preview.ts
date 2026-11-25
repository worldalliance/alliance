import { branches } from "@alliance/common/expression/branches";
import type { Scope } from "@alliance/common/expression/catalog";
import { printNames } from "@alliance/common/expression/check";
import { reads } from "@alliance/common/expression/dependencies";
import { printExpression } from "@alliance/common/expression/print";
import type { Expr } from "@alliance/common/expression/tree";
import { PartWork } from "@alliance/common/suite-partition";
import { countBy } from "es-toolkit";
import { workOf, type PartitionPart } from "./partition-parts";
import { ResolutionKind, resolvePart } from "./partition-resolve";

export type PartitionPreview = {
  population: number;
  parts: { partId: string; count: number }[];
  byWork: Record<PartWork, number>;
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
export function previewPartition(params: {
  parts: readonly PartitionPart[];
  scope: Scope;
  actionIds: readonly number[];
  userIds: readonly number[];
  members: ReadonlyMap<string, ReadonlySet<number>>;
}): PartitionPreview {
  const { parts, scope, actionIds, userIds, members } = params;
  const taken = new Set<Expr>();
  const placed: string[] = [];
  const errors: string[] = [];
  for (const userId of userIds) {
    const resolution = resolvePart({
      parts,
      scope,
      isOnList: (listId) => members.get(listId)?.has(userId) ?? false,
      onBranch: (node) => taken.add(node),
    });
    switch (resolution.kind) {
      case ResolutionKind.Placed:
        placed.push(resolution.partId);
        break;
      case ResolutionKind.CouldNotDecide:
        errors.push(resolution.message);
        break;
      default:
        throw new Error(`unknown resolution: ${resolution satisfies never}`);
    }
  }
  const counts = countBy(placed, (partId) => partId);
  const byWork: Record<PartWork, number> = {
    [PartWork.Required]: 0,
    [PartWork.OptionalOnly]: 0,
    [PartWork.Nothing]: 0,
  };
  for (const part of parts) {
    byWork[workOf(part, actionIds)] += counts[part.id] ?? 0;
  }
  return {
    population: userIds.length,
    parts: parts.map((part) => ({
      partId: part.id,
      count: counts[part.id] ?? 0,
    })),
    byWork,
    couldNotDecide: errors.length,
    errors: Object.entries(countBy(errors, (message) => message)).map(
      ([message, count]) => ({ message, count }),
    ),
    untakenBranches: untaken({ parts, scope, taken }),
  };
}

function untaken({
  parts,
  scope,
  taken,
}: {
  parts: readonly PartitionPart[];
  scope: Scope;
  taken: ReadonlySet<Expr>;
}): { where: string; text: string }[] {
  const names = printNames({ scope });
  const sources: { where: string; tree: Expr }[] = parts.flatMap((part) =>
    part.condition === null ? [] : [{ where: part.name, tree: part.condition }],
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
