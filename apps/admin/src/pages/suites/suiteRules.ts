import {
  eventInEffectAt,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type {
  ActionEventDto,
  ActionStatus,
  ActionSuiteDto,
  AdminActionListItemDto,
} from "@alliance/shared/client";

type SuiteEvent = Pick<ActionEventDto, "date" | "newStatus">;

/**
 * The phase a suite's shared events put its tasks in, read as the server reads
 * a task's status: the event in effect now, else Draft. A task may be further
 * along through events of its own.
 */
export const suitePhase = (
  events: readonly SuiteEvent[],
  now: Date,
): ActionStatus =>
  eventInEffectAt([...events], now).event?.newStatus ?? "draft";

/**
 * Launched, with members' start still ahead: its tasks are Draft and hidden
 * until then, and members see them from then with nothing more to do.
 */
export const isScheduled = (phase: ActionStatus, membersStart: string | null) =>
  phase === "draft" && membersStart !== null;

/** When members start, and their deadline: the first event after the start. */
export const suiteDates = (events: readonly SuiteEvent[]) => {
  const { event, deadlineEvent } = memberActionPhase([...events]);
  return {
    membersStart: event?.date ?? null,
    deadline: deadlineEvent?.date ?? null,
  };
};

export type SuiteRow = {
  id: number;
  name: string;
  /** Null, like the three values after it, when the tasks didn't load. */
  tasks: readonly { id: number; name: string }[] | null;
  phase: ActionStatus | null;
  membersStart: string | null;
  deadline: string | null;
};

type ListedTask = Pick<AdminActionListItemDto, "id" | "name" | "events"> & {
  suite?: { id: number };
};

/**
 * The suites list's rows, newest launch first with the suites not yet dated
 * above them. The list endpoint sends a suite's name alone, so its tasks and
 * shared events come from the all-tasks list. The server stores the shared
 * events as a copy on each task, and a task moved in after launch has none, so
 * they are read from the first task that has any.
 */
export function suiteRows({
  suites,
  tasks,
  now,
}: {
  suites: readonly Pick<ActionSuiteDto, "id" | "name">[];
  tasks: readonly ListedTask[] | undefined;
  now: Date;
}): SuiteRow[] {
  const bySuite = new Map<number, ListedTask[]>();
  for (const task of tasks ?? []) {
    if (!task.suite) continue;
    bySuite.set(task.suite.id, [...(bySuite.get(task.suite.id) ?? []), task]);
  }
  const rows = suites.map(({ id, name }): SuiteRow => {
    if (!tasks) {
      return {
        id,
        name,
        tasks: null,
        phase: null,
        membersStart: null,
        deadline: null,
      };
    }
    const own = bySuite.get(id) ?? [];
    const shared = (
      own.find((task) => task.events.some((event) => event.suiteManaged))
        ?.events ?? []
    ).filter((event) => event.suiteManaged);
    return {
      id,
      name,
      tasks: own.map((task) => ({ id: task.id, name: task.name })),
      phase: suitePhase(shared, now),
      ...suiteDates(shared),
    };
  });
  const start = (row: SuiteRow) =>
    row.membersStart === null
      ? Number.POSITIVE_INFINITY
      : new Date(row.membersStart).getTime();
  return rows.sort((a, b) => start(b) - start(a) || b.id - a.id);
}
