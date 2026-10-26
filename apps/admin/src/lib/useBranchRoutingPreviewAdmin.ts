import type { CohortExpression } from "@alliance/common/cohort-expression";
import { actionFormsPreviewBranchRoutingAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useMemo } from "react";

export type BranchRouting = {
  userIds: ReadonlySet<number>;
  evaluating: boolean;
  error: unknown;
};

const noUserIds: ReadonlySet<number> = new Set();

const isRule = (rule: CohortExpression | null): rule is CohortExpression =>
  rule !== null;

/** The members the last of `rules` would get, routed after the rules before it. */
export function useBranchRoutingPreviewAdmin(params: {
  actionId: number;
  rules: readonly (CohortExpression | null)[];
}): BranchRouting {
  const { actionId } = params;
  const rules = params.rules.every(isRule) ? params.rules : null;
  const preview = useQuery({
    queryKey: queryKeys.branchRoutingPreviewAdmin(actionId, rules ?? []),
    queryFn: rules
      ? () =>
          actionFormsPreviewBranchRoutingAdmin({
            path: { id: actionId },
            body: { rules: [...rules] },
            throwOnError: true,
          }).then((res) => res.data.branches)
      : skipToken,
    staleTime: milliseconds({ minutes: 1 }),
  });
  const { data, isError } = preview;
  const userIds = useMemo(
    () => (data && !isError ? new Set(data.at(-1)?.userIds) : noUserIds),
    [data, isError],
  );
  return { userIds, evaluating: preview.isLoading, error: preview.error };
}
