import type { AdminActionListItemDto } from "@alliance/shared/client";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { readBuckets, writeBuckets } from "../../lib/actionListBuckets";
import {
  ActionStatusBucket,
  actionStatusBucket,
} from "../../lib/actionStatusBucket";

export const NO_STATUS_MATCH = "No tasks match the selected statuses.";
const ALL_ARCHIVED = "Every task is archived.";
export const SHOW_ARCHIVED_ID = "tasks-show-archived";

export type TaskFilters = {
  buckets: ReadonlySet<ActionStatusBucket>;
  showArchived: boolean;
};

/**
 * The Timeline's status filter and the Timeline and List's Show archived, kept
 * in `?status=` and `?archived=1`.
 * Each change pushes history, so Back steps through them as it did on `/actions`.
 */
export function useTaskFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = useCallback(
    (key: string, value: string | null) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      }),
    [setSearchParams],
  );
  return {
    buckets: readBuckets(searchParams.get("status")),
    showArchived: searchParams.get("archived") === "1",
    setBuckets: (buckets: ReadonlySet<ActionStatusBucket>) =>
      setParam("status", writeBuckets(buckets)),
    setShowArchived: (show: boolean) => setParam("archived", show ? "1" : null),
  };
}

/** The tasks left once archived ones are hidden, and those the status filter then keeps. */
export function filterTasks<T extends AdminActionListItemDto>(
  tasks: readonly T[],
  { buckets, showArchived }: TaskFilters,
): { unarchived: T[]; shown: T[] } {
  const unarchived = tasks.filter((task) => showArchived || !task.archived);
  return {
    unarchived,
    shown: unarchived.filter((task) => buckets.has(actionStatusBucket(task))),
  };
}

/** Why the filters leave nothing to show, or null when something shows or nothing loaded. */
export function filteredOutReason({
  total,
  unarchived,
  shown,
}: {
  total: number;
  unarchived: number;
  shown: number;
}): string | null {
  if (total === 0) return null;
  if (unarchived === 0) return ALL_ARCHIVED;
  return shown === 0 ? NO_STATUS_MATCH : null;
}
