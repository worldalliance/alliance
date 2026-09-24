import type {
  ArrayMethodName,
  NumberMethodName,
  StringMethodName,
} from "./variable-expression";

// Each node costs a step, each method call what it reads of its receiver plus
// the length of its result, and each text `+` builds, list turned into text, or
// text read as a number the length of that text, so nested loops over long text
// or lists can't hold a thread for seconds.
const MAX_EVALUATION_STEPS = 1_000_000;

export class EvaluationTooLong extends Error {}

enum ReceiverCost {
  // Reads a bounded part of its receiver, or no more than it returns.
  None,
  Length,
  // Reads every item of every nested list.
  Nested,
}

const RECEIVER_COSTS: ReadonlyMap<string, ReceiverCost> = new Map(
  Object.entries({
    map: ReceiverCost.Length,
    filter: ReceiverCost.Length,
    flatMap: ReceiverCost.Length,
    find: ReceiverCost.Length,
    findIndex: ReceiverCost.Length,
    findLast: ReceiverCost.Length,
    findLastIndex: ReceiverCost.Length,
    some: ReceiverCost.Length,
    every: ReceiverCost.Length,
    reduce: ReceiverCost.Length,
    sort: ReceiverCost.Nested,
    reverse: ReceiverCost.Length,
    slice: ReceiverCost.None,
    concat: ReceiverCost.None,
    includes: ReceiverCost.Length,
    indexOf: ReceiverCost.Length,
    lastIndexOf: ReceiverCost.Length,
    at: ReceiverCost.None,
    join: ReceiverCost.Nested,
    flat: ReceiverCost.Nested,
    toLowerCase: ReceiverCost.Length,
    toUpperCase: ReceiverCost.Length,
    trim: ReceiverCost.Length,
    trimStart: ReceiverCost.Length,
    trimEnd: ReceiverCost.Length,
    charAt: ReceiverCost.None,
    substring: ReceiverCost.None,
    startsWith: ReceiverCost.None,
    endsWith: ReceiverCost.None,
    split: ReceiverCost.Length,
    replace: ReceiverCost.Length,
    replaceAll: ReceiverCost.Length,
    repeat: ReceiverCost.None,
    padStart: ReceiverCost.None,
    padEnd: ReceiverCost.None,
    toFixed: ReceiverCost.None,
    toPrecision: ReceiverCost.None,
  } satisfies Record<
    ArrayMethodName | StringMethodName | NumberMethodName,
    ReceiverCost
  >),
);

// Evaluation is synchronous, so one counter serves the outermost call and every
// lambda and nested node it evaluates.
let stepsLeft: number | undefined;

/** Runs `evaluate` under a fresh budget unless one is already running. */
export function withStepBudget<T>(evaluate: () => T): T {
  if (stepsLeft !== undefined) return evaluate();
  stepsLeft = MAX_EVALUATION_STEPS;
  try {
    return evaluate();
  } finally {
    stepsLeft = undefined;
  }
}

export function spendSteps(steps: number): void {
  if (stepsLeft === undefined) return;
  stepsLeft -= steps;
  if (stepsLeft < 0) {
    throw new EvaluationTooLong("The formula takes too long to work out.");
  }
}

export function sizeOf(value: unknown): number {
  return typeof value === "string" || Array.isArray(value) ? value.length : 1;
}

export function spendOnNested(value: unknown): void {
  spendSteps(sizeOf(value));
  if (Array.isArray(value)) value.forEach(spendOnNested);
}

export function spendOnReceiver(target: unknown, method: string): void {
  const cost = RECEIVER_COSTS.get(method);
  switch (cost) {
    case ReceiverCost.None:
      return;
    case ReceiverCost.Length:
      return spendSteps(sizeOf(target));
    case ReceiverCost.Nested:
      return spendOnNested(target);
    case undefined:
      throw new Error(`no receiver cost for method: ${method}`);
    default:
      throw new Error(`unknown receiver cost: ${cost satisfies never}`);
  }
}
