import {
  cohortDecisionsCorrectAdmin,
  cohortDecisionsListForActionAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCohortDecisionsAdmin(actionId: number) {
  return useQuery({
    queryKey: queryKeys.actionCohortDecisionsAdmin(actionId),
    queryFn: () =>
      cohortDecisionsListForActionAdmin({
        path: { actionId },
        throwOnError: true,
      }).then((res) => res.data),
  });
}

export function useCorrectCohortDecisionAdmin(params: {
  actionId: number;
  onSuccess: () => void;
}) {
  const { actionId, onSuccess } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: number; included: boolean; note: string }) =>
      cohortDecisionsCorrectAdmin({
        path: { actionId, userId: input.userId },
        body: { included: input.included, note: input.note },
        throwOnError: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.actionCohortDecisionsAdmin(actionId),
      });
      onSuccess();
    },
  });
}
