import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useCallback } from "react";
import { actionsFindOne } from "../client";
import { ActionSource, actionStore, selectAction } from "./actionStore";
import { queryKeys } from "./queryKeys";
import { currentSession } from "./sessionStores";
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
  const session = currentSession(queryClient);
  const select = useCallback((id: number) => selectAction(state, id), [state]);
  const query = useQuery({
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

  const markCompleted = useCallback(async () => {
    if (actionId !== null)
      store.recordRelation({ actionId, relation: "completed", session });
  }, [store, actionId, session]);

  const markDeclined = useCallback(async () => {
    if (actionId !== null)
      store.recordRelation({ actionId, relation: "declined", session });
  }, [store, actionId, session]);

  return { query, markCompleted, markDeclined };
}
