import type { CohortExpression } from "@alliance/common/cohort-expression";
import { actionsEvaluateCohortAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useMemo } from "react";

export const cohortEvaluationQuery = (
  expression: CohortExpression | null | undefined,
) =>
  queryOptions({
    queryKey: queryKeys.cohortEvaluationAdmin(expression ?? null),
    queryFn: expression
      ? () =>
          actionsEvaluateCohortAdmin({
            body: { expression },
            throwOnError: true,
          }).then((r) => r.data)
      : skipToken,
    staleTime: milliseconds({ minutes: 1 }),
  });

const noUserIds: ReadonlySet<number> = new Set();

/** The ids of the users `expression` matches: none without an expression,
 * before its first result, or once an evaluation fails, even a refetch of an
 * earlier result. */
export function useCohortEvaluationAdmin(
  expression: CohortExpression | null | undefined,
) {
  const evaluation = useQuery(cohortEvaluationQuery(expression));
  const { data, isError } = evaluation;
  const userIds = useMemo(
    (): ReadonlySet<number> =>
      data && !isError ? new Set(data.userIds) : noUserIds,
    [data, isError],
  );
  return {
    userIds,
    evaluating: evaluation.isLoading,
    error: evaluation.error,
  };
}
