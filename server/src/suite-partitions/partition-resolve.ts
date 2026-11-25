import type { Scope } from "@alliance/common/expression/catalog";
import { evaluate } from "@alliance/common/expression/evaluate";
import {
  FailureKind,
  type EvalFailure,
} from "@alliance/common/expression/failure";
import type { Expr } from "@alliance/common/expression/tree";
import { R } from "@alliance/common/result";
import { z } from "zod";
import { PartFallback, type PartitionPart } from "./partition-parts";

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
      partId: z.string(),
      outcome: z.enum(TraceOutcome),
      message: z.string().optional(),
    }),
  ),
  lists: z.array(z.object({ listId: z.string(), on: z.boolean() })),
});

/** Each part tried, in order, and each list membership read. */
export type Trace = z.infer<typeof traceSchema>;

export enum ResolutionKind {
  Placed = "placed",
  CouldNotDecide = "could_not_decide",
}

export type Resolution =
  | { kind: ResolutionKind.Placed; partId: string; trace: Trace }
  | { kind: ResolutionKind.CouldNotDecide; message: string; trace: Trace };

const NOTHING_TO_READ = R.failure<EvalFailure>({
  kind: FailureKind.Error,
  message: "Parts can read only member lists and formulas.",
});

/**
 * The first part the member matches, deciding an undecided condition by the
 * part's fallback. An evaluation error stops at that part: the member is
 * never moved on to a later part, "Everyone else" included.
 */
export function resolvePart(params: {
  parts: readonly PartitionPart[];
  scope: Scope;
  isOnList: (listId: string) => boolean;
  onBranch?: (taken: Expr) => void;
}): Resolution {
  const { parts, scope, onBranch } = params;
  const trace: Trace = { steps: [], lists: [] };
  const isOnList = (listId: string) => {
    const on = params.isOnList(listId);
    if (!trace.lists.some((read) => read.listId === listId)) {
      trace.lists.push({ listId, on });
    }
    return R.success(on);
  };
  for (const part of parts) {
    if (part.condition === null) {
      trace.steps.push({ partId: part.id, outcome: TraceOutcome.Matched });
      return { kind: ResolutionKind.Placed, partId: part.id, trace };
    }
    const result = evaluate(part.condition, {
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
          : "It waited on something partitions can't wait for yet.";
      trace.steps.push({
        partId: part.id,
        outcome: TraceOutcome.Error,
        message,
      });
      return { kind: ResolutionKind.CouldNotDecide, message, trace };
    }
    const outcome = outcomeOf(result.value, part.fallback);
    trace.steps.push({ partId: part.id, outcome });
    if (
      outcome === TraceOutcome.Matched ||
      outcome === TraceOutcome.UndecidedPutHere
    ) {
      return { kind: ResolutionKind.Placed, partId: part.id, trace };
    }
  }
  throw new Error("a partition ends with a part that has no condition");
}

function outcomeOf(
  value: unknown,
  fallback: PartFallback | null,
): TraceOutcome {
  if (value === true) return TraceOutcome.Matched;
  if (value === false) return TraceOutcome.NotMatched;
  if (value !== null)
    throw new Error("a part condition gave a non yes/no value");
  switch (fallback) {
    case PartFallback.PutHere:
      return TraceOutcome.UndecidedPutHere;
    case PartFallback.Continue:
      return TraceOutcome.UndecidedContinued;
    case null:
      throw new Error("an undecided part condition has no fallback picked");
    default:
      throw new Error(`unknown fallback: ${fallback satisfies never}`);
  }
}
