import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  userCreateAmbassadorInviteGoal,
  userDeleteAmbassadorInviteGoal,
  userGetAmbassadorInviteDashboard,
  userUpdateAmbassadorInviteGoal,
} from "../client";
import { queryKeys } from "./queryKeys";

const QUERY_KEY = queryKeys.ambassadorInviteDashboard();

export function useAmbassadorInviteDashboard(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      userGetAmbassadorInviteDashboard({ throwOnError: true }).then(
        (r) => r.data,
      ),
    enabled,
  });

  const createGoalMutation = useMutation({
    mutationFn: (body: {
      targetSuccessfulRecruits: number;
      startAt: string;
      dueAt: string;
    }) =>
      userCreateAmbassadorInviteGoal({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: (params: {
      goalId: number;
      body: {
        targetSuccessfulRecruits?: number;
        startAt?: string;
        dueAt?: string;
      };
    }) =>
      userUpdateAmbassadorInviteGoal({
        path: { goalId: params.goalId },
        body: params.body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: number) =>
      userDeleteAmbassadorInviteGoal({
        path: { goalId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    ...query,
    createGoal: createGoalMutation.mutateAsync,
    isCreatingGoal: createGoalMutation.isPending,
    updateGoal: updateGoalMutation.mutateAsync,
    isUpdatingGoal: updateGoalMutation.isPending,
    deleteGoal: deleteGoalMutation.mutateAsync,
    isDeletingGoal: deleteGoalMutation.isPending,
  };
}
