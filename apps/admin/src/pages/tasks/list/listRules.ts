import { eventInEffectAt } from "@alliance/common/actionEvent";
import type {
  ActionDto,
  AdminActionListItemDto,
} from "@alliance/shared/client";
import {
  ACTION_STATUS_BUCKET_LABELS,
  ActionStatusBucket,
} from "../../../lib/actionStatusBucket";
import { inProgressSuites } from "../../../lib/inProgressSuites";

export const getLastPastEventDate = (
  action: Pick<ActionDto, "events">,
): Date | null => {
  const { event } = eventInEffectAt(action.events, new Date());
  return event ? new Date(event.date) : null;
};

export type SuiteGroup<T> = {
  id: number | null;
  name: string;
  tasks: T[];
  /** "1 active · 2 draft": the group's tasks that are in progress. */
  inProgress: string;
};

/**
 * Tasks by suite, "No suite" among them, in the order of each suite's first
 * unarchived task in `tasks` (the server's, latest event first). A suite
 * whose tasks are all archived goes last.
 */
export function groupBySuite<T extends AdminActionListItemDto>(
  tasks: readonly T[],
): SuiteGroup<T>[] {
  const groups = new Map<number | null, { name: string; tasks: T[] }>();
  for (const task of tasks) {
    const id = task.suite?.id ?? null;
    const group = groups.get(id) ?? {
      name: task.suite?.name ?? "No suite",
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(id, group);
  }
  const counts = new Map(
    inProgressSuites([...tasks]).map((suite) => [
      suite.id,
      Object.values(ActionStatusBucket)
        .map((bucket) => {
          const count = suite.actions.filter(
            (task) => task.bucket === bucket,
          ).length;
          return count > 0
            ? `${count} ${ACTION_STATUS_BUCKET_LABELS[bucket].toLowerCase()}`
            : null;
        })
        .filter((part) => part !== null)
        .join(" · "),
    ]),
  );
  const rank = (group: { tasks: T[] }) => {
    const live = group.tasks.filter((task) => !task.archived);
    const ranked = live.length > 0 ? live : group.tasks;
    return Math.min(...ranked.map((task) => tasks.indexOf(task)));
  };
  const archivedOnly = (group: { tasks: T[] }) =>
    group.tasks.every((task) => task.archived);
  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      ...group,
      inProgress: (id !== null && counts.get(id)) || "",
    }))
    .sort(
      (a, b) =>
        Number(archivedOnly(a)) - Number(archivedOnly(b)) || rank(a) - rank(b),
    );
}
