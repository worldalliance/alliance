import {
  cohortDecisionsArmMovePreviewAdmin,
  cohortDecisionsCorrectAdmin,
  cohortDecisionsListForActionAdmin,
  cohortDecisionsMoveToArmAdmin,
  cohortDecisionsRemoveFromSplitAdmin,
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

export function useArmMovePreviewAdmin(params: {
  actionId: number;
  userId: number;
}) {
  return useQuery({
    queryKey: queryKeys.armMovePreviewAdmin(params),
    queryFn: () =>
      cohortDecisionsArmMovePreviewAdmin({
        path: params,
        throwOnError: true,
      }).then((res) => res.data),
    staleTime: 0,
  });
}

export enum ArmChangeKind {
  Move = "move",
  Remove = "remove",
}

export function useChangeArmAdmin(params: {
  armActionIds: number[];
  onSuccess: () => void;
}) {
  const { armActionIds, onSuccess } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: ArmChangeKind;
      /** The arm to move into, or any arm of the split to remove from it. */
      actionId: number;
      userId: number;
      note: string;
    }) => {
      const options = {
        path: { actionId: input.actionId, userId: input.userId },
        body: { note: input.note },
        throwOnError: true,
      } as const;
      switch (input.kind) {
        case ArmChangeKind.Move:
          return cohortDecisionsMoveToArmAdmin(options);
        case ArmChangeKind.Remove:
          return cohortDecisionsRemoveFromSplitAdmin(options);
        default:
          throw new Error(`unknown arm change: ${input.kind satisfies never}`);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        ...armActionIds.map((actionId) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.actionCohortDecisionsAdmin(actionId),
          }),
        ),
        queryClient.invalidateQueries({
          queryKey: queryKeys.armMovePreviewsAdmin(),
        }),
      ]);
      onSuccess();
    },
  });
}
