import { R } from "@alliance/common/result";
import { useCallback, useEffect, useState } from "react";
import { ActionDto, actionsFindOne } from "../client";
import { withOptimisticRelation } from "./actionUtils";
import { useOnNextActionEvent } from "./useOnNextDeadline";

export function useActionHandlers(
  actionId: number,
  isAuthenticated: boolean,
  reloadTasks: () => unknown,
) {
  const [action, setAction] = useState<ActionDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAction = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) setLoading(true);
      const result = await R.fromPromise(
        actionsFindOne({ path: { id: actionId } }),
      );
      const data = R.match(result, {
        success: (response) => response.data ?? null,
        failure: () => null,
      });
      if (data) {
        setAction(data);
      } else if (!silent) {
        // Only initial (non-silent) loads report absence. A background refetch
        // that comes back empty keeps the last good payload: besides network
        // errors and 5xxs, this API 404s on *visibility* failures too (e.g. an
        // expired token downgrading the request to anonymous), so an empty
        // response mid-session doesn't reliably mean the action is gone.
        // Worst case for a truly deleted action: the stale page lingers and
        // submits fail server-side until navigation.
        setAction(null);
      }
      if (!silent) setLoading(false);
    },
    [actionId],
  );

  useEffect(() => {
    fetchAction();
  }, [fetchAction, isAuthenticated]);

  // The payload is fetch-time data: `status` and `viewer.*` are computed
  // server-side at response time, and nothing here polls. Refetch as each
  // scheduled event boundary passes so e.g. the task form unlocks the moment
  // the member-action phase opens while the page stays mounted.
  const refetchOnEventBoundary = useCallback(() => {
    void fetchAction({ silent: true });
  }, [fetchAction]);
  useOnNextActionEvent(action, refetchOnEventBoundary);

  const onCompleteAction = useCallback(async () => {
    if (!action) return;
    setAction((action) => ({
      ...withOptimisticRelation(action!, "completed"),
      usersCompleted: action!.usersCompleted + 1,
    }));
    reloadTasks();
  }, [action, reloadTasks]);

  const onOptOutAction = useCallback(async () => {
    if (!action) return;
    setAction((action) => withOptimisticRelation(action!, "declined"));
    reloadTasks();
  }, [action]);

  return {
    action,
    loading,
    refetchAction: fetchAction,
    onCompleteAction,
    onOptOutAction,
  };
}
