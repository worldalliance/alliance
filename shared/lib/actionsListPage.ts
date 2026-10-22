import {
  QueryClient,
  UseQueryOptions,
  UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
// eslint-disable-next-line api-client/named-hooks-only -- the TanStack hooks in this file own these calls
import {
  ActionDto,
  actionsDismissAction,
  actionsFindAllLoggedIn,
} from "../client";
import {
  FilterMode,
  hasViewerCompletedAction,
  withOptimisticDismissal,
  withOptimisticRelation,
} from "./actionUtils";
import { thrownRefusalMessage } from "./hey-api";
import { queryKeys } from "./queryKeys";

export const useActionsQuery = (options?: {
  refetchInterval?: UseQueryOptions<ActionDto[], Error>["refetchInterval"];
}): UseQueryResult<ActionDto[], Error> =>
  useQuery({
    queryKey: queryKeys.actions(),
    queryFn: ({ signal }) =>
      actionsFindAllLoggedIn({
        query: { sorted: true },
        throwOnError: true,
        signal,
      }).then((response) =>
        response.data.filter(
          (action) => action.status !== "draft" || action.viewer?.staffPreview,
        ),
      ),
    refetchInterval: options?.refetchInterval,
  });

export const invalidateActions = (queryClient: QueryClient): void =>
  void queryClient.invalidateQueries({ queryKey: queryKeys.actions() });

export function useInvalidateActions(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => invalidateActions(queryClient), [queryClient]);
}

export function useDismissActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: number) =>
      actionsDismissAction({ path: { id: actionId }, throwOnError: true }),
    onSuccess: (_data, actionId) =>
      applyConfirmedChange({
        queryClient,
        actionId,
        patch: withOptimisticDismissal,
      }),
  });
}

export const dismissActionErrorMessage = (error: unknown): string =>
  thrownRefusalMessage({
    error,
    fallback: "Couldn't dismiss this task. Please try again.",
    sessionExpired: "Your session has expired. Sign in again.",
  });

/** Applies a completion or withdrawal the server has just confirmed. */
export function useRecordActionRelation(): (
  actionId: number,
  relation: "completed" | "declined",
) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (actionId, relation) =>
      applyConfirmedChange({
        queryClient,
        actionId,
        patch: (action) => withOptimisticRelation(action, relation),
      }),
    [queryClient],
  );
}

/**
 * Patches the cached list, then refetches. The invalidation cancels any
 * fetch already in flight, whose response predates the change and would
 * otherwise restore the action.
 */
function applyConfirmedChange(params: {
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
  invalidateActions(queryClient);
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
      return actions.filter(hasViewerCompletedAction);
    case FilterMode.PendingOfficeResolution:
      return actions.filter((action) => action.status === "office_action");
    case FilterMode.MemberAction:
      return actions.filter(
        (action) => action.status === "member_action" && !action.onboarding,
      );
    case FilterMode.Past:
      return actions.filter(
        (action) => action.status === "completed" || action.status === "failed",
      );
    default:
      const x: never = mode;
      throw new Error(`Invalid filter mode: ${x}`);
  }
};
