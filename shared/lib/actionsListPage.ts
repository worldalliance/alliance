import {
  QueryClient,
  UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  ActionDto,
  actionsDismissAction,
  actionsFindAllLoggedIn,
} from "../client";
import {
  FilterMode,
  withOptimisticDismissal,
  withOptimisticRelation,
} from "./actionUtils";
import { queryKeys } from "./queryKeys";

export const useActionsQuery = (options?: {
  refetchInterval?: number | false;
}): UseQueryResult<ActionDto[], Error> =>
  useQuery({
    queryKey: queryKeys.actions(),
    queryFn: () =>
      actionsFindAllLoggedIn({
        query: { sorted: true },
        throwOnError: true,
      }).then((response) =>
        response.data.filter(
          (action) => action.status !== "draft" || action.viewer?.staffPreview,
        ),
      ),
    refetchInterval: options?.refetchInterval,
  });

export function useInvalidateActions(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.actions() });
  }, [queryClient]);
}

export function useDismissActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: number) =>
      actionsDismissAction({ path: { id: actionId } }),
    onSuccess: (_data, actionId) =>
      patchCachedAction({
        queryClient,
        actionId,
        patch: withOptimisticDismissal,
      }),
  });
}

export function useMarkActionCompleted(): (actionId: number) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (actionId) => {
      patchCachedAction({
        queryClient,
        actionId,
        patch: (action) => withOptimisticRelation(action, "completed"),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.actions() });
    },
    [queryClient],
  );
}

function patchCachedAction(params: {
  queryClient: QueryClient;
  actionId: number;
  patch: (action: ActionDto) => ActionDto;
}): void {
  const { queryClient, actionId, patch } = params;
  queryClient.setQueryData<ActionDto[] | undefined>(
    queryKeys.actions(),
    (prev) =>
      prev?.map((action) => (action.id === actionId ? patch(action) : action)),
  );
}

export const filterActions = (
  actions: ActionDto[],
  mode: FilterMode,
): ActionDto[] => {
  switch (mode) {
    case FilterMode.All:
      return actions.filter(
        (action) => action.status !== "planned" && action.status !== "draft",
      );
    case FilterMode.CompletedByMe:
      return actions.filter((action) => action.userRelation === "completed");
    case FilterMode.PendingOfficeResolution:
      return actions.filter((action) => action.status === "office_action");
    case FilterMode.MemberAction:
      return actions.filter(
        (action) => action.status === "member_action" && !action.onboarding,
      );
    default:
      const x: never = mode;
      throw new Error(`Invalid filter mode: ${x}`);
  }
};
