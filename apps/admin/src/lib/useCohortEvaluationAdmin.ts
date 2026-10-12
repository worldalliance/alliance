import type { CohortExpression } from "@alliance/common/cohort-expression";
import {
  actionsEvaluateCohortAdmin,
  type EvaluateCohortExpressionResponseDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

const noUserIds: ReadonlySet<number> = new Set();

const toUserIds = (
  response: EvaluateCohortExpressionResponseDto,
): ReadonlySet<number> => new Set(response.userIds);

/** The ids of the users `expression` matches, or none without an expression.
 * While a changed expression evaluates, `userIds` still holds the previous
 * result and `evaluating` is true. */
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
    // Without an expression the result is known to be empty, so a later
    // expression evaluates over no ids rather than those from before the clear.
    initialData: expression ? undefined : { userIds: [] },
    select: toUserIds,
    placeholderData: keepPreviousData,
    staleTime: milliseconds({ minutes: 1 }),
  });
  return {
    userIds: evaluation.data ?? noUserIds,
    evaluating: evaluation.isLoading || evaluation.isPlaceholderData,
    error: evaluation.error,
  };
}
