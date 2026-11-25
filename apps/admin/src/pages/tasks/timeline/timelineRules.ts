import {
  eventInEffectAt,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";
import type { TimelineRow } from "../../../lib/actionTimelineData";
import { hashString } from "../../../lib/identitySwatch";

export enum GroupBy {
  Suite = "suite",
  Project = "project",
}

export const GROUP_BY_PARAM = "group";

/** The grouping a `group` search param names; by suite when absent or unknown. */
export const readGroupBy = (param: string | null): GroupBy =>
  param === GroupBy.Project ? GroupBy.Project : GroupBy.Suite;

export const PIXELS_PER_DAY = 16;
export const NAME_COLUMN_PX = 320;
export const GROUP_PX = 56;
export const ROW_PX = 56;

export type XForTime = (time: Date | number) => number;

export type ProjectCat = 1 | 2 | 3 | 4 | 5 | 6;
const CATS = [1, 2, 3, 4, 5, 6] as const satisfies readonly ProjectCat[];

/** The server stores no colour, so a project's comes from its id and never changes. */
export const projectCat = (projectId: number): ProjectCat =>
  CATS[hashString(String(projectId)) % CATS.length];

// Literal class names, so Tailwind sees each one.
export const PROJECT_CAT_CLASS: Record<
  ProjectCat,
  { solid: string; soft: string; border: string }
> = {
  1: { solid: "bg-cat-1", soft: "bg-cat-1-soft", border: "border-cat-1" },
  2: { solid: "bg-cat-2", soft: "bg-cat-2-soft", border: "border-cat-2" },
  3: { solid: "bg-cat-3", soft: "bg-cat-3-soft", border: "border-cat-3" },
  4: { solid: "bg-cat-4", soft: "bg-cat-4-soft", border: "border-cat-4" },
  5: { solid: "bg-cat-5", soft: "bg-cat-5-soft", border: "border-cat-5" },
  6: { solid: "bg-cat-6", soft: "bg-cat-6-soft", border: "border-cat-6" },
};

type SuiteEvent = Pick<ActionEventDto, "date" | "newStatus" | "suiteManaged">;

/**
 * The phase a suite's shared events put its tasks in: the shared event in
 * effect now, else Draft. The server stores a suite's events as a copy on each
 * task, marked `suiteManaged`.
 */
export const suitePhase = (
  events: readonly SuiteEvent[],
  now: Date,
): ActionStatus =>
  eventInEffectAt(
    events.filter((event) => event.suiteManaged),
    now,
  ).event?.newStatus ?? "draft";

/** When a suite's members start, to their shared deadline; null until both are set. */
export const suiteWindow = (
  events: readonly SuiteEvent[],
): GroupSpan | null => {
  const { event, deadlineEvent } = memberActionPhase(
    events.filter((shared) => shared.suiteManaged),
  );
  if (!event || !deadlineEvent) return null;
  return { start: new Date(event.date), end: new Date(deadlineEvent.date) };
};

export type GroupSpan = { start: Date; end: Date };

export type TimelineGroup = {
  key: string;
  kind: GroupBy;
  /** Null for the tasks in no suite or no project. */
  id: number | null;
  name: string;
  rows: TimelineRow[];
  /** A suite's phase, from its shared events. */
  phase: ActionStatus | null;
  /**
   * Drawn on the group's header row: a suite's shared window from its members'
   * start to their deadline, a project's stretch from its first bar to its last.
   */
  span: GroupSpan | null;
};

type GroupSource = {
  suite?: { id: number; name: string } | null;
  project?: { id: number; name: string } | null;
  events: readonly SuiteEvent[];
};

const spanOf = (rows: TimelineRow[]): GroupSpan | null => {
  const phases = rows.flatMap((row) => row.phases);
  if (phases.length === 0) return null;
  return {
    start: new Date(Math.min(...phases.map((p) => p.startDate.getTime()))),
    end: new Date(
      Math.max(
        ...phases.map((p) =>
          (p.status === "completed" ? p.startDate : p.endDate).getTime(),
        ),
      ),
    ),
  };
};

/** Every task in a suite carries its shared events; a draft added later has none yet. */
const sharedEvents = (
  suiteId: number,
  sources: ReadonlyMap<number, GroupSource>,
): readonly SuiteEvent[] =>
  [...sources.values()]
    .filter((source) => source.suite?.id === suiteId)
    .map((source) => source.events)
    .find((events) => events.some((event) => event.suiteManaged)) ?? [];

/**
 * The rows in groups, keeping the rows' order inside each group; a group sits
 * where its first row did. The group of tasks with no suite or project is last.
 */
export const groupRows = ({
  rows,
  sources,
  by,
  now,
}: {
  rows: TimelineRow[];
  /** Every loaded task by id, shown or not, so a suite's shared events don't depend on the filters. */
  sources: ReadonlyMap<number, GroupSource>;
  by: GroupBy;
  now: Date;
}): TimelineGroup[] => {
  const groups = new Map<string, TimelineGroup>();
  for (const row of rows) {
    const source = sources.get(row.action.id);
    const owner = by === GroupBy.Suite ? source?.suite : source?.project;
    const key = owner ? `${by}-${owner.id}` : `${by}-none`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        kind: by,
        id: owner?.id ?? null,
        name: owner?.name ?? (by === GroupBy.Suite ? "No suite" : "No project"),
        rows: [],
        phase: null,
        span: null,
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  const ordered = [...groups.values()].map((group): TimelineGroup => {
    if (group.id === null) return group;
    switch (group.kind) {
      case GroupBy.Project:
        return { ...group, span: spanOf(group.rows) };
      case GroupBy.Suite: {
        const events = sharedEvents(group.id, sources);
        return {
          ...group,
          phase: suitePhase(events, now),
          span: suiteWindow(events),
        };
      }
      default:
        throw new Error(`unknown grouping: ${group.kind satisfies never}`);
    }
  });
  return [
    ...ordered.filter((group) => group.id !== null),
    ...ordered.filter((group) => group.id === null),
  ];
};

/** Each row's top in the body, below the sticky header, by task id. */
export const rowTops = ({
  groups,
  withHeaders,
}: {
  groups: readonly Pick<TimelineGroup, "rows">[];
  withHeaders: boolean;
}): Map<number, number> => {
  const tops = new Map<number, number>();
  let top = 0;
  for (const group of groups) {
    if (withHeaders) top += GROUP_PX;
    for (const row of group.rows) {
      tops.set(row.action.id, top);
      top += ROW_PX;
    }
  }
  return tops;
};

/** A phase's word fits in its bar; under that the bar keeps only its tooltip. */
export const labelFits = (label: string, widthPx: number) =>
  widthPx >= label.length * 7 + 16;
