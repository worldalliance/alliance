import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useCallback } from "react";
import { actionsFindOne } from "../client";
import { ActionSource, actionStore, selectAction } from "./actionStore";
import { queryKeys } from "./queryKeys";
import { useStoreState } from "./useStoreState";

export function useAction(
  actionId: number | null,
  params?: { enabled?: boolean; staleTime?: number },
) {
  const {
    enabled = true,
    // Long enough that re-hovering an action link reuses its preview.
    staleTime = milliseconds({ minutes: 5 }),
  } = params ?? {};
  const queryClient = useQueryClient();
  const store = actionStore(queryClient);
  const state = useStoreState(actionStore);
  const select = useCallback((id: number) => selectAction(state, id), [state]);
  return useQuery({
    queryKey: queryKeys.action(actionId),
    queryFn:
      actionId === null
        ? skipToken
        : async ({ signal }) => {
            await store.load({
              source: ActionSource.Detail,
              signal,
              fetch: () =>
                actionsFindOne({
                  path: { id: actionId },
                  throwOnError: true,
                  signal,
                }).then((res) => [res.data]),
            });
            return actionId;
          },
    select,
    enabled,
    staleTime,
  });
}
