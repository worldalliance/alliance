import { useCallback, useEffect, useRef, useState } from "react";
import { thrownStatus } from "./hey-api";
import { useHeldWhileTaskCompletes } from "./TaskFlowCompletionContext";
import { useAction } from "./useAction";
import { useOnNextActionEvent } from "./useOnNextDeadline";

export function useActionHandlers(
  actionId: number,
  isAuthenticated: boolean,
  reloadTasks: () => unknown,
) {
  const {
    query: { data, dataUpdatedAt, isPending, error, errorUpdatedAt, refetch },
    markCompleted,
    markDeclined,
  } = useAction(actionId, { staleTime: 0 });

  // A 404 reports absence only when it answers the load this page started on
  // mount or on an id or auth change, before any load since then succeeded. A
  // later 404 keeps the last payload: this API also 404s on visibility
  // failures, such as an expired token downgrading the request to anonymous,
  // so a mid-session 404 doesn't reliably mean the action is gone.
  const loadKey = `${actionId}:${isAuthenticated}`;
  const [loadStart, setLoadStart] = useState({
    loadKey,
    dataUpdatedAt,
    errorUpdatedAt,
  });
  if (loadStart.loadKey !== loadKey) {
    setLoadStart({ loadKey, dataUpdatedAt, errorUpdatedAt });
  }
  const notFound =
    thrownStatus(error) === 404 &&
    errorUpdatedAt !== loadStart.errorUpdatedAt &&
    dataUpdatedAt === loadStart.dataUpdatedAt;
  const action = useHeldWhileTaskCompletes(
    notFound ? null : (data ?? null),
    actionId,
  );

  const previousIsAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (previousIsAuthenticated.current === isAuthenticated) return;
    previousIsAuthenticated.current = isAuthenticated;
    void refetch();
  }, [isAuthenticated, refetch]);

  // The payload is fetch-time data: `status` and `viewer.*` are computed
  // server-side at response time, and nothing here polls. Refetch as each
  // scheduled event boundary passes so e.g. the task form unlocks the moment
  // the member-action phase opens while the page stays mounted.
  const refetchOnEventBoundary = useCallback(() => {
    void refetch();
  }, [refetch]);
  useOnNextActionEvent(action, refetchOnEventBoundary);

  const onCompleteAction = useCallback(async () => {
    await markCompleted();
    reloadTasks();
  }, [markCompleted, reloadTasks]);

  const onOptOutAction = useCallback(async () => {
    await markDeclined();
    reloadTasks();
  }, [markDeclined, reloadTasks]);

  return {
    action,
    loading: isPending,
    notFound,
    refetchAction: refetch,
    onCompleteAction,
    onOptOutAction,
    onDeadlinePassed: refetchOnEventBoundary,
  };
}
