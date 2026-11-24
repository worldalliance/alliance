import type { Scope } from "@alliance/common/expression/catalog";
import { evaluate } from "@alliance/common/expression/evaluate";
import {
  FailureKind,
  type EvalFailure,
} from "@alliance/common/expression/failure";
import type { Expr } from "@alliance/common/expression/tree";
import { R } from "@alliance/common/result";
import { z } from "zod";
import { GroupFallback, type SplitGroup } from "./split-groups";

export enum TraceOutcome {
  Matched = "matched",
  NotMatched = "not_matched",
  UndecidedPutHere = "undecided_put_here",
  UndecidedContinued = "undecided_continued",
  Error = "error",
}

export const traceSchema = z.object({
  steps: z.array(
    z.object({
      groupId: z.string(),
      outcome: z.enum(TraceOutcome),
      message: z.string().optional(),
    }),
  ),
  lists: z.array(z.object({ listId: z.string(), on: z.boolean() })),
});

/** Each group tried, in order, and each list membership read. */
export type Trace = z.infer<typeof traceSchema>;

export enum ResolutionKind {
  Placed = "placed",
  CouldNotDecide = "could_not_decide",
}

export type Resolution =
  | { kind: ResolutionKind.Placed; groupId: string; trace: Trace }
  | { kind: ResolutionKind.CouldNotDecide; message: string; trace: Trace };

const NOTHING_TO_READ = R.failure<EvalFailure>({
  kind: FailureKind.Error,
  message: "Groups can read only member lists and formulas.",
});

/**
 * The first group the member matches, deciding an undecided condition by the
 * group's fallback. An evaluation error stops at that group: the member is
 * never moved on to a later group, "Everyone else" included.
 */
export function resolveGroup(params: {
  groups: readonly SplitGroup[];
  scope: Scope;
  isOnList: (listId: string) => boolean;
  onBranch?: (taken: Expr) => void;
}): Resolution {
  const { groups, scope, onBranch } = params;
  const trace: Trace = { steps: [], lists: [] };
  const isOnList = (listId: string) => {
    const on = params.isOnList(listId);
    if (!trace.lists.some((read) => read.listId === listId)) {
      trace.lists.push({ listId, on });
    }
    return R.success(on);
  };
  for (const group of groups) {
    if (group.condition === null) {
      trace.steps.push({ groupId: group.id, outcome: TraceOutcome.Matched });
      return { kind: ResolutionKind.Placed, groupId: group.id, trace };
    }
    const result = evaluate(group.condition, {
      ...scope,
      readInput: () => NOTHING_TO_READ,
      callFunction: () => NOTHING_TO_READ,
      isOnList,
      onBranch,
    });
    if (!result.ok) {
      const message =
        result.error.kind === FailureKind.Error
          ? result.error.message
          : "It waited on something splits can't wait for yet.";
      trace.steps.push({
        groupId: group.id,
        outcome: TraceOutcome.Error,
        message,
      });
      return { kind: ResolutionKind.CouldNotDecide, message, trace };
    }
    const outcome = outcomeOf(result.value, group.fallback);
    trace.steps.push({ groupId: group.id, outcome });
    if (
      outcome === TraceOutcome.Matched ||
      outcome === TraceOutcome.UndecidedPutHere
    ) {
      return { kind: ResolutionKind.Placed, groupId: group.id, trace };
    }
  }
  throw new Error("a split ends with a group that has no condition");
}

function outcomeOf(
  value: unknown,
  fallback: GroupFallback | null,
): TraceOutcome {
  if (value === true) return TraceOutcome.Matched;
  if (value === false) return TraceOutcome.NotMatched;
  if (value !== null)
    throw new Error("a group condition gave a non yes/no value");
  switch (fallback) {
    case GroupFallback.PutHere:
      return TraceOutcome.UndecidedPutHere;
    case GroupFallback.Continue:
      return TraceOutcome.UndecidedContinued;
    case null:
      throw new Error("an undecided group condition has no fallback picked");
    default:
      throw new Error(`unknown fallback: ${fallback satisfies never}`);
  }
}
