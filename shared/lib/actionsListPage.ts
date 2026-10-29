import {
  QueryClient,
  UseQueryResult,
  queryOptions,
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
import { ActionSource, actionStore, selectAction } from "./actionStore";
import { FilterMode, hasViewerCompletedAction } from "./actionUtils";
import { thrownRefusalMessage } from "./hey-api";
import { queryKeys } from "./queryKeys";
import { useStoreState } from "./useStoreState";

export const actionsQuery = queryOptions({
  queryKey: queryKeys.actions(),
  queryFn: ({ signal, client }) =>
    actionStore(client).load({
      source: ActionSource.List,
      signal,
      fetch: () =>
        actionsFindAllLoggedIn({
          query: { sorted: true },
          throwOnError: true,
          signal,
        }).then((response) =>
          response.data.filter(
            (action) =>
              action.status !== "draft" || action.viewer?.staffPreview,
          ),
        ),
    }),
});

export const useActionsQuery = (options?: {
  refetchInterval?: (typeof actionsQuery)["refetchInterval"];
}): UseQueryResult<ActionDto[], Error> => {
  const state = useStoreState(actionStore);
  const select = useCallback(
    (ids: number[]) => ids.map((id) => selectAction(state, id)),
    [state],
  );
  return useQuery({
    ...actionsQuery,
    select,
    refetchInterval: options?.refetchInterval,
  });
};

export const invalidateActions = (queryClient: QueryClient): void =>
  void queryClient.invalidateQueries({ queryKey: queryKeys.actions() });

export function useInvalidateActions(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => invalidateActions(queryClient), [queryClient]);
}

export function useDismissActionMutation() {
  const queryClient = useQueryClient();
  const store = actionStore(queryClient);
  return useMutation({
    onMutate: () => store.getSession(),
    mutationFn: (actionId: number) =>
      actionsDismissAction({ path: { id: actionId }, throwOnError: true }),
    onSuccess: (_data, actionId, session) => {
      if (store.recordDismissal({ actionId, session }))
        invalidateActions(queryClient);
    },
  });
}

export const dismissActionErrorMessage = (error: unknown): string =>
  thrownRefusalMessage({
    error,
    fallback: "Couldn't dismiss this task. Please try again.",
    sessionExpired: "Your session has expired. Sign in again.",
  });

/** Applies a completion or withdrawal the server has just confirmed. */
export function useRecordActionRelation(): (params: {
  actionId: number;
  relation: "completed" | "declined";
  session: number;
}) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (params) => {
      if (actionStore(queryClient).recordRelation(params))
        invalidateActions(queryClient);
    },
    [queryClient],
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
