export enum FailureKind {
  Error = "error",
  Pending = "pending",
}

/**
 * Why an expression has no value. Neither is unknown: an error is final, and
 * pending waits on the keys in `waitingOn`, such as earlier actions.
 */
export type EvalFailure =
  | { kind: FailureKind.Error; message: string }
  | { kind: FailureKind.Pending; waitingOn: readonly string[] };

function describe(failure: EvalFailure): string {
  switch (failure.kind) {
    case FailureKind.Error:
      return failure.message;
    case FailureKind.Pending:
      return `pending on ${failure.waitingOn.join(", ")}`;
    default:
      throw new Error(`unknown failure: ${failure satisfies never}`);
  }
}

export class Failure extends Error {
  constructor(readonly failure: EvalFailure) {
    super(describe(failure));
  }
}

export const evalError = (message: string) =>
  new Failure({ kind: FailureKind.Error, message });

export function finite(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw evalError(`${what} didn't give a finite number.`);
  }
  return value;
}

/** An error outranks pending, since waiting can't make it go away. */
export function combine(failures: readonly EvalFailure[]): EvalFailure {
  const waitingOn = new Set<string>();
  for (const failure of failures) {
    switch (failure.kind) {
      case FailureKind.Error:
        return failure;
      case FailureKind.Pending:
        failure.waitingOn.forEach((key) => waitingOn.add(key));
        break;
      default:
        throw new Error(`unknown failure: ${failure satisfies never}`);
    }
  }
  return { kind: FailureKind.Pending, waitingOn: [...waitingOn] };
}

/**
 * Runs `run` on every item before failing, so an error on a later item
 * outranks pending on an earlier one. A bug that isn't a `Failure` is
 * rethrown as is.
 */
export function runEvery<T, R>(
  items: readonly T[],
  run: (item: T, index: number) => R,
): R[] {
  const results: R[] = [];
  const failures: EvalFailure[] = [];
  for (const [index, item] of items.entries()) {
    try {
      results.push(run(item, index));
    } catch (thrown) {
      if (!(thrown instanceof Failure)) throw thrown;
      failures.push(thrown.failure);
    }
  }
  if (failures.length > 0) throw new Failure(combine(failures));
  return results;
}
