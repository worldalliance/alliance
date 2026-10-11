import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { actionsGetWithdrawalsAdmin } from "../client";
import type { ActionWithdrawalDto } from "../client/types.gen";
import { queryKeys } from "./queryKeys";

const NO_WITHDRAWALS = new Map<number, ActionWithdrawalDto>();

const byUserId = (withdrawals: ActionWithdrawalDto[]) =>
  new Map(withdrawals.map((withdrawal) => [withdrawal.userId, withdrawal]));

/** Withdrawals from the action that owns `formId`, keyed by user id. */
export function useFormWithdrawalsAdmin(formId: number | undefined) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.formWithdrawalsAdmin(formId ?? null),
    [formId],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn:
      formId === undefined
        ? skipToken
        : () =>
            actionsGetWithdrawalsAdmin({
              path: { formId },
              throwOnError: true,
            }).then((res) => res.data),
    select: byUserId,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey],
  );

  return {
    withdrawnUserMap: data ?? NO_WITHDRAWALS,
    isLoading,
    isError,
    refresh,
  };
}
