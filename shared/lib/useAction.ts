import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useCallback } from "react";
import { ActionDto, actionsFindOne } from "../client";
import {
  hasViewerCompletedAction,
  withOptimisticRelation,
} from "./actionUtils";
import { queryKeys } from "./queryKeys";

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
  const query = useQuery({
    queryKey: queryKeys.action(actionId),
    queryFn:
      actionId === null
        ? skipToken
        : () =>
            actionsFindOne({ path: { id: actionId }, throwOnError: true }).then(
              (res) => res.data,
            ),
    enabled,
    staleTime,
  });

  const updateAction = useCallback(
    async (update: (action: ActionDto) => ActionDto) => {
      const queryKey = queryKeys.action(actionId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ActionDto>(
        queryKey,
        (action) => action && update(action),
      );
    },
    [queryClient, actionId],
  );

  const markCompleted = useCallback(
    () =>
      updateAction((action) =>
        hasViewerCompletedAction(action)
          ? action
          : {
              ...withOptimisticRelation(action, "completed"),
              usersCompleted: action.usersCompleted + 1,
            },
      ),
    [updateAction],
  );

  const markDeclined = useCallback(
    () => updateAction((action) => withOptimisticRelation(action, "declined")),
    [updateAction],
  );

  return { query, markCompleted, markDeclined };
}
