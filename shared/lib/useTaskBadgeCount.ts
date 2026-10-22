import {
  countsTowardTaskBadge,
  countTaskBadge,
} from "@alliance/common/taskBadge";
import { milliseconds } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useActionsQuery } from "./actionsListPage";
import { isRefused } from "./retryQuery";
import { useOnNextTimestamp } from "./useOnNextDeadline";

const TASK_BADGE_REFRESH_MS = milliseconds({ minutes: 1 });

/**
 * The Tasks badge count, or null before the first load. A failed refetch
 * keeps the last count, and a counted action drops out at its deadline
 * without waiting for a refetch.
 */
export function useTaskBadgeCount(): number | null {
  const { data: actions } = useActionsQuery({
    refetchInterval: (query) =>
      isRefused(query.state.error) ? false : TASK_BADGE_REFRESH_MS,
  });
  const [deadlineTick, setDeadlineTick] = useState(0);
  const onDeadlinePassed = useCallback(() => setDeadlineTick((t) => t + 1), []);

  const { count, deadlines } = useMemo(() => {
    void deadlineTick;
    if (!actions) {
      return { count: null, deadlines: undefined };
    }
    const now = new Date();
    return {
      count: countTaskBadge(actions, now),
      deadlines: actions.flatMap((action) =>
        countsTowardTaskBadge(action, now) && action.viewer?.deadlineAt
          ? [new Date(action.viewer.deadlineAt).getTime()]
          : [],
      ),
    };
  }, [actions, deadlineTick]);
  useOnNextTimestamp(deadlines, onDeadlinePassed);

  return count;
}

/**
 * The Tasks badge count, also passed to `write` after every fetch of the
 * action list, even one that leaves the count unchanged. `write` must be
 * stable.
 */
export function useTaskBadgeMirror(
  write: (count: number) => unknown,
): number | null {
  const count = useTaskBadgeCount();
  const { dataUpdatedAt } = useActionsQuery();

  useEffect(() => {
    if (count !== null) {
      void write(count);
    }
  }, [count, dataUpdatedAt, write]);

  return count;
}
