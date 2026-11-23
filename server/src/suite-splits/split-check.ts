import type {
  Diagnostic,
  NamedExpression,
  Scope,
} from "@alliance/common/expression/catalog";
import { TypeKind } from "@alliance/common/expression/catalog";
import {
  Undecided,
  checkExpression,
  printNames,
  type ResultRule,
} from "@alliance/common/expression/check";
import { reads } from "@alliance/common/expression/dependencies";
import { printExpression } from "@alliance/common/expression/print";
import {
  BinaryOp,
  ExprKind,
  type Expr,
} from "@alliance/common/expression/tree";
import { R, type Result } from "@alliance/common/result";
import { BadRequestException } from "@nestjs/common";
import { isEqual } from "es-toolkit";
import {
  EVERYONE_ELSE,
  GroupFallback,
  GroupWork,
  workOf,
  type SplitGroup,
} from "./split-groups";

/** A group as the admin edits it: `text` is null only for "Everyone else". */
export type GroupDraft = Omit<
  SplitGroup,
  "condition" | "noRequiredWorkTick"
> & {
  text: string | null;
  noRequiredWorkTick: boolean;
};

export type SplitProblem =
  | { groupId: string | null; message: string }
  | { groupId: string; text: string; diagnostics: Diagnostic[] };

export type SplitWarning = { groupId: string; message: string };

export const ONLY_LISTS_AND_FORMULAS =
  "Groups can read only member lists and formulas for now: waiting for earlier actions and settings isn't built yet.";

/** Only a condition that can be undecided keeps its fallback, so a stored fallback always means something. */
export const storedFallback = (params: {
  mayBeUnknown: boolean;
  fallback: GroupFallback | null;
}): GroupFallback | null => (params.mayBeUnknown ? params.fallback : null);

export function groupRule(fallback: GroupFallback | null): ResultRule {
  return {
    type: { kind: TypeKind.Boolean },
    undecided:
      fallback === null ? Undecided.NeedsGroupFallback : Undecided.Allowed,
  };
}

/**
 * Why a group condition reads something splits can't wait for yet, through
 * the named expressions it reads; `undefined` when it reads only lists and
 * formulas.
 */
export function outsideReads(
  tree: Expr,
  named: readonly NamedExpression[],
): string | undefined {
  const found = reads(tree, named);
  return found.inputs.size + found.functions.size > 0
    ? ONLY_LISTS_AND_FORMULAS
    : undefined;
}

/**
 * Checks a split as the admin saved it against `actionIds`, the suite's
 * actions. On success returns the groups to store, with each fallback a
 * condition can't need, and each tick the group's work no longer matches,
 * dropped, plus the warnings the save still shows.
 */
export function checkSplit(params: {
  drafts: readonly GroupDraft[];
  scope: Scope;
  actionIds: readonly number[];
}): Result<{ groups: SplitGroup[]; warnings: SplitWarning[] }, SplitProblem[]> {
  const { drafts, scope, actionIds } = params;
  const problems = structureProblems(drafts);
  const groups: SplitGroup[] = [];
  for (const draft of drafts) {
    const { text, noRequiredWorkTick } = draft;
    // Plain cells, not the request's DTO instances, so `isEqual` against a
    // stored version can match.
    const kept = {
      id: draft.id,
      name: draft.name.trim(),
      cells: draft.cells.map(({ actionId, assignment }) => ({
        actionId,
        assignment,
      })),
    };
    const work = workOf(draft, actionIds);
    const tick =
      noRequiredWorkTick && work !== GroupWork.Required ? work : null;
    if (text === null) {
      groups.push({
        ...kept,
        condition: null,
        fallback: null,
        noRequiredWorkTick: tick,
      });
      continue;
    }
    const checked = checkExpression({
      source: text,
      scope,
      rule: groupRule(draft.fallback),
    });
    if (!checked.ok) {
      problems.push({ groupId: draft.id, text, diagnostics: checked.error });
      continue;
    }
    const outside = outsideReads(checked.value.tree, scope.named);
    if (outside !== undefined) {
      problems.push({ groupId: draft.id, message: outside });
      continue;
    }
    groups.push({
      ...kept,
      condition: checked.value.tree,
      fallback: storedFallback({
        mayBeUnknown: checked.value.mayBeUnknown,
        fallback: draft.fallback,
      }),
      noRequiredWorkTick: tick,
    });
  }
  if (problems.length > 0) return R.failure(problems);
  return R.success({ groups, warnings: warnings(groups, scope, actionIds) });
}

function structureProblems(drafts: readonly GroupDraft[]): SplitProblem[] {
  const last = drafts.at(-1);
  if (last === undefined || last.text !== null || last.name !== EVERYONE_ELSE) {
    throw new BadRequestException(
      `A split ends with "${EVERYONE_ELSE}" and no condition.`,
    );
  }
  if (new Set(drafts.map((draft) => draft.id)).size !== drafts.length) {
    throw new BadRequestException("Each group needs its own id.");
  }
  const problems: SplitProblem[] = [];
  const seen = new Set<string>();
  for (const draft of drafts.slice(0, -1)) {
    if (draft.text === null) {
      throw new BadRequestException("Only the last group has no condition.");
    }
    const name = draft.name.trim();
    const key = name.toLowerCase();
    if (name.length === 0 || name.length > 100) {
      problems.push({
        groupId: draft.id,
        message: "Name the group in 1 to 100 characters.",
      });
    } else if (seen.has(key) || key === EVERYONE_ELSE.toLowerCase()) {
      problems.push({
        groupId: draft.id,
        message: `Another group is already called "${name}".`,
      });
    }
    seen.add(key);
  }
  return problems;
}

function warnings(
  groups: readonly SplitGroup[],
  scope: Scope,
  actionIds: readonly number[],
): SplitWarning[] {
  const found: SplitWarning[] = [];
  for (const [index, group] of groups.entries()) {
    const work = workOf(group, actionIds);
    if (work !== GroupWork.Required && group.noRequiredWorkTick !== work) {
      found.push({
        groupId: group.id,
        message: `"${group.name}" has no required work. Tick "This group intentionally has no required work" if that's intended.`,
      });
    }
    const coveredBy = groups
      .slice(0, index)
      .find((earlier) => covers({ earlier, later: group, scope }));
    if (coveredBy !== undefined) {
      found.push({
        groupId: group.id,
        message: `No member can reach "${group.name}": everyone it matches is placed in "${coveredBy.name}" first.`,
      });
    }
  }
  return found;
}

/**
 * Whether every member matching `later` is placed in `earlier` first, by a
 * structural check rather than a solver: `earlier` always matches, or it is one
 * of the conditions `later` requires with `&&`, through named expressions. A
 * group that may continue members it can't decide covers only where those
 * members can't reach the later group either, so it counts only when it puts
 * them here.
 */
function covers({
  earlier,
  later,
  scope,
}: {
  earlier: SplitGroup;
  later: SplitGroup;
  scope: Scope;
}): boolean {
  if (earlier.condition === null) return true;
  if (earlier.fallback !== null && earlier.fallback !== GroupFallback.PutHere) {
    return false;
  }
  const resolved = resolveRefs(earlier.condition, scope);
  if (isEqual(resolved, { kind: ExprKind.Literal, value: true })) return true;
  if (later.condition === null) return false;
  return conjuncts(later.condition, scope).some((part) =>
    isEqual(part, resolved),
  );
}

function resolveRefs(expr: Expr, scope: Scope): Expr {
  const seen = new Set<string>();
  let current = expr;
  while (current.kind === ExprKind.Ref && !seen.has(current.id)) {
    seen.add(current.id);
    const id = current.id;
    const definition = scope.named.find((each) => each.id === id);
    if (definition === undefined) return current;
    current = definition.tree;
  }
  return current;
}

function conjuncts(expr: Expr, scope: Scope): Expr[] {
  const resolved = resolveRefs(expr, scope);
  return resolved.kind === ExprKind.Binary && resolved.op === BinaryOp.And
    ? [...conjuncts(resolved.left, scope), ...conjuncts(resolved.right, scope)]
    : [resolved];
}

/**
 * Re-checks stored groups at go-live: a formula or list they read can have
 * changed since the split was saved. Spared the needless-fallback check, as
 * stored formulas are.
 */
export function checkStoredGroups(params: {
  groups: readonly SplitGroup[];
  scope: Scope;
}): SplitProblem[] {
  const { groups, scope } = params;
  const named = new Set(scope.named.map((each) => each.id));
  return groups.flatMap((group): SplitProblem[] => {
    if (group.condition === null) return [];
    const checked = checkExpression({
      source: group.condition,
      scope,
      rule: groupRule(group.fallback),
      stored: { root: true, named },
    });
    if (!checked.ok) {
      return [
        {
          groupId: group.id,
          text: printGroup(group.condition, scope),
          diagnostics: checked.error,
        },
      ];
    }
    const outside = outsideReads(group.condition, scope.named);
    return outside === undefined
      ? []
      : [{ groupId: group.id, message: outside }];
  });
}

export const printGroup = (condition: Expr, scope: Scope) =>
  printExpression(condition, printNames({ scope }));
