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
import { PartWork } from "@alliance/common/suite-partition";
import { BadRequestException } from "@nestjs/common";
import { isEqual } from "es-toolkit";
import {
  EVERYONE_ELSE,
  PartFallback,
  workOf,
  type PartitionPart,
} from "./partition-parts";

/** A part as the admin edits it: `text` is null only for "Everyone else". */
export type PartDraft = Omit<
  PartitionPart,
  "condition" | "noRequiredWorkTick"
> & {
  text: string | null;
  noRequiredWorkTick: boolean;
};

export type PartitionProblem =
  | { partId: string | null; message: string }
  | { partId: string; text: string; diagnostics: Diagnostic[] };

export type PartitionWarning = { partId: string; message: string };

export const ONLY_LISTS_AND_FORMULAS =
  "Parts can read only member lists and formulas for now: waiting for earlier actions and settings isn't built yet.";

/** Only a condition that can be undecided keeps its fallback, so a stored fallback always means something. */
export const storedFallback = (params: {
  mayBeUnknown: boolean;
  fallback: PartFallback | null;
}): PartFallback | null => (params.mayBeUnknown ? params.fallback : null);

export function partRule(fallback: PartFallback | null): ResultRule {
  return {
    type: { kind: TypeKind.Boolean },
    undecided:
      fallback === null ? Undecided.NeedsPartFallback : Undecided.Allowed,
  };
}

/**
 * Why a part condition reads something partitions can't wait for yet, through
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
 * Checks a partition as the admin saved it against `actionIds`, the suite's
 * actions. On success returns the parts to store, with each fallback a
 * condition can't need, and each tick the part's work no longer matches,
 * dropped, plus the warnings the save still shows.
 */
export function checkPartition(params: {
  drafts: readonly PartDraft[];
  scope: Scope;
  actionIds: readonly number[];
}): Result<
  { parts: PartitionPart[]; warnings: PartitionWarning[] },
  PartitionProblem[]
> {
  const { drafts, scope, actionIds } = params;
  const problems = structureProblems(drafts);
  const parts: PartitionPart[] = [];
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
    const tick = noRequiredWorkTick && work !== PartWork.Required ? work : null;
    if (text === null) {
      parts.push({
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
      rule: partRule(draft.fallback),
    });
    if (!checked.ok) {
      problems.push({ partId: draft.id, text, diagnostics: checked.error });
      continue;
    }
    const outside = outsideReads(checked.value.tree, scope.named);
    if (outside !== undefined) {
      problems.push({ partId: draft.id, message: outside });
      continue;
    }
    parts.push({
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
  return R.success({ parts, warnings: warnings(parts, scope, actionIds) });
}

function structureProblems(drafts: readonly PartDraft[]): PartitionProblem[] {
  const last = drafts.at(-1);
  if (last === undefined || last.text !== null || last.name !== EVERYONE_ELSE) {
    throw new BadRequestException(
      `A partition ends with "${EVERYONE_ELSE}" and no condition.`,
    );
  }
  if (new Set(drafts.map((draft) => draft.id)).size !== drafts.length) {
    throw new BadRequestException("Each part needs its own id.");
  }
  const problems: PartitionProblem[] = [];
  const seen = new Set<string>();
  for (const draft of drafts.slice(0, -1)) {
    if (draft.text === null) {
      throw new BadRequestException("Only the last part has no condition.");
    }
    const name = draft.name.trim();
    const key = name.toLowerCase();
    if (name.length === 0 || name.length > 100) {
      problems.push({
        partId: draft.id,
        message: "Name the part in 1 to 100 characters.",
      });
    } else if (seen.has(key) || key === EVERYONE_ELSE.toLowerCase()) {
      problems.push({
        partId: draft.id,
        message: `Another part is already called "${name}".`,
      });
    }
    seen.add(key);
  }
  return problems;
}

function warnings(
  parts: readonly PartitionPart[],
  scope: Scope,
  actionIds: readonly number[],
): PartitionWarning[] {
  const found: PartitionWarning[] = [];
  for (const [index, part] of parts.entries()) {
    const work = workOf(part, actionIds);
    if (work !== PartWork.Required && part.noRequiredWorkTick !== work) {
      found.push({
        partId: part.id,
        message: `"${part.name}" has no required work. Tick "This part intentionally has no required work" if that's intended.`,
      });
    }
    const coveredBy = parts
      .slice(0, index)
      .find((earlier) => covers({ earlier, later: part, scope }));
    if (coveredBy !== undefined) {
      found.push({
        partId: part.id,
        message: `No member can reach "${part.name}": everyone it matches is placed in "${coveredBy.name}" first.`,
      });
    }
  }
  return found;
}

/**
 * Whether every member matching `later` is placed in `earlier` first, by a
 * structural check rather than a solver: `earlier` always matches, or it is one
 * of the conditions `later` requires with `&&`, through named expressions. A
 * part that may continue members it can't decide covers only where those
 * members can't reach the later part either, so it counts only when it puts
 * them here.
 */
function covers({
  earlier,
  later,
  scope,
}: {
  earlier: PartitionPart;
  later: PartitionPart;
  scope: Scope;
}): boolean {
  if (earlier.condition === null) return true;
  if (earlier.fallback !== null && earlier.fallback !== PartFallback.PutHere) {
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
 * Re-checks stored parts at go-live: a formula or list they read can have
 * changed since the partition was saved. Spared the needless-fallback check, as
 * stored formulas are.
 */
export function checkStoredParts(params: {
  parts: readonly PartitionPart[];
  scope: Scope;
}): PartitionProblem[] {
  const { parts, scope } = params;
  const named = new Set(scope.named.map((each) => each.id));
  return parts.flatMap((part): PartitionProblem[] => {
    if (part.condition === null) return [];
    const checked = checkExpression({
      source: part.condition,
      scope,
      rule: partRule(part.fallback),
      stored: { root: true, named },
    });
    if (!checked.ok) {
      return [
        {
          partId: part.id,
          text: printPart(part.condition, scope),
          diagnostics: checked.error,
        },
      ];
    }
    const outside = outsideReads(part.condition, scope.named);
    return outside === undefined ? [] : [{ partId: part.id, message: outside }];
  });
}

export const printPart = (condition: Expr, scope: Scope) =>
  printExpression(condition, printNames({ scope }));
