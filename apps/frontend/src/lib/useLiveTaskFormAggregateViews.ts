import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import { tasksGetFormAggregateViews } from "@alliance/shared/client";
import { parseAggregateViewsPayload } from "@alliance/shared/lib/actionAggregates";
import { runAsync } from "@alliance/shared/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

/**
 * Loads aggregate views for a task form, refetches when participation/completion
 * signals change, and refetches when any TanStack `actions` query updates.
 */
export function useLiveTaskFormAggregateViews(
  taskFormId: number | null | undefined,
  usersCompleted?: number,
  userRelation?: string | null,
): AggregateViewSchema[] {
  const queryClient = useQueryClient();
  const [aggregateViews, setAggregateViews] = useState<AggregateViewSchema[]>(
    [],
  );

  const loadAggregateViews = useCallback(
    async (signal?: AbortSignal) => {
      if (taskFormId == null) {
        if (!signal?.aborted) {
          setAggregateViews([]);
        }
        return;
      }
      const response = await tasksGetFormAggregateViews({
        path: { id: taskFormId },
      });
      if (signal?.aborted) {
        return;
      }
      setAggregateViews(
        parseAggregateViewsPayload(response.data?.aggregateViews),
      );
    },
    [taskFormId],
  );

  useEffect(() => {
    const abortController = new AbortController();
    runAsync(async () => {
      await loadAggregateViews(abortController.signal);
    });
    return () => {
      abortController.abort();
    };
  }, [loadAggregateViews, usersCompleted, userRelation]);

  useEffect(() => {
    let inFlight: AbortController | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") {
        return;
      }
      const key = event.query.queryKey;
      if (key[0] !== "actions") {
        return;
      }
      if (taskFormId == null) {
        return;
      }
      inFlight?.abort();
      inFlight = new AbortController();
      const signal = inFlight.signal;
      runAsync(async () => {
        await loadAggregateViews(signal);
      });
    });
    return () => {
      inFlight?.abort();
      unsubscribe();
    };
  }, [queryClient, loadAggregateViews, taskFormId]);

  return aggregateViews;
}
