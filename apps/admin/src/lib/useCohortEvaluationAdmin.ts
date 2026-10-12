import type { CohortExpression } from "@alliance/common/cohort-expression";
import {
  actionsEvaluateCohortAdmin,
  type EvaluateCohortExpressionResponseDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

const noUserIds: ReadonlySet<number> = new Set();

const toUserIds = (
  response: EvaluateCohortExpressionResponseDto,
): ReadonlySet<number> => new Set(response.userIds);

/** The ids of the users `expression` matches: none without an expression,
 * before its first result, or once an evaluation fails, even a refetch of an
 * earlier result. */
export function useCohortEvaluationAdmin(
  expression: CohortExpression | null | undefined,
) {
  const evaluation = useQuery({
    queryKey: queryKeys.cohortEvaluationAdmin(expression ?? null),
    queryFn: expression
      ? () =>
          actionsEvaluateCohortAdmin({
            body: { expression },
            throwOnError: true,
          }).then((r) => r.data)
      : skipToken,
    select: toUserIds,
    staleTime: milliseconds({ minutes: 1 }),
  });
  return {
    userIds: evaluation.isError ? noUserIds : (evaluation.data ?? noUserIds),
    evaluating: evaluation.isLoading,
    error: evaluation.error,
  };
}
