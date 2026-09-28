import { R, type Result } from "./result";

export enum PrerequisiteDeadlineProblem {
  Missing = "Missing",
  NotFirst = "NotFirst",
}

/**
 * A prerequisite needs a deadline that comes before its dependent's, or a
 * member could wait forever or become ready after the dependent closed.
 */
export function checkPrerequisiteDeadline(params: {
  upstream: Date | null;
  dependent: Date | null;
}): Result<void, PrerequisiteDeadlineProblem> {
  const { upstream, dependent } = params;
  if (!upstream) return R.failure(PrerequisiteDeadlineProblem.Missing);
  if (dependent && upstream >= dependent) {
    return R.failure(PrerequisiteDeadlineProblem.NotFirst);
  }
  return R.success(undefined);
}
