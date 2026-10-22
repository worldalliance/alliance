import { skipToken, useQuery } from "@tanstack/react-query";
import { actionsGetWithdrawalsAdmin } from "../client";
import type { ActionWithdrawalDto } from "../client/types.gen";
import { queryKeys } from "./queryKeys";

const NO_WITHDRAWALS = new Map<number, ActionWithdrawalDto>();

const byUserId = (withdrawals: ActionWithdrawalDto[]) =>
  new Map(withdrawals.map((withdrawal) => [withdrawal.userId, withdrawal]));

/** Withdrawals from the action that owns `formId`, keyed by user id. */
export function useFormWithdrawalsAdmin(formId: number | undefined) {
  const { data, isLoading, isLoadingError } = useQuery({
    queryKey: queryKeys.formWithdrawalsAdmin(formId ?? null),
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

  return {
    withdrawnUserMap: data ?? NO_WITHDRAWALS,
    isLoading,
    isLoadingError,
  };
}
