import type { ActionStatus } from "@alliance/shared/client";
import { buildTimelineData } from "../../lib/actionTimelineData";
import {
  type ProjectStep,
  STEP_COUNT_BUCKET,
  StepCountBucket,
} from "../../lib/projectCards";

export type LaneBar = {
  status: ActionStatus;
  start: Date;
  /** Null for a phase no later event ends. */
  end: Date | null;
  /** Shares of the scale, as CSS lengths. */
  left: string;
  width: string;
};

export type ProjectTimeline = {
  start: Date;
  end: Date;
  /** Where now falls on the scale; null when now is off it. */
  now: string | null;
  barsByStepId: ReadonlyMap<number, LaneBar[]>;
};

/**
 * The steps' phases on one scale, from the first event to the last, or to now
 * while a phase is still open, so an open phase draws up to today. Null when
 * no step has an event. Completed phases are left out: they have no end.
 */
export const projectTimeline = (
  steps: ProjectStep[],
  now: Date,
): ProjectTimeline | null => {
  const eventTimes = steps.flatMap((step) =>
    step.events.map((event) => new Date(event.date).getTime()),
  );
  if (eventTimes.length === 0) return null;
  const { timelineData } = buildTimelineData({
    actions: steps,
    normalizedReminders: [],
    latestLaunchFirst: false,
  });
  const anyOpen = timelineData.some((row) => {
    const last = row.phases.at(-1);
    return (
      last !== undefined &&
      STEP_COUNT_BUCKET[last.status] !== StepCountBucket.Done
    );
  });
  const start = Math.min(...eventTimes);
  const lastEvent = Math.max(...eventTimes);
  const end = anyOpen ? Math.max(lastEvent, now.getTime()) : lastEvent;
  const span = Math.max(end - start, 1);
  const share = (time: number) =>
    (Math.min(Math.max(time - start, 0), span) / span) * 100;

  return {
    start: new Date(start),
    end: new Date(end),
    now:
      now.getTime() >= start && now.getTime() <= end
        ? `${share(now.getTime())}%`
        : null,
    barsByStepId: new Map(
      timelineData.map((row) => [
        row.action.id,
        row.phases
          .filter((phase) => phase.status !== "completed")
          .map((phase): LaneBar => {
            // The builder gives a last phase an end a week from now to draw to.
            const open = phase === row.phases.at(-1);
            const from = share(phase.startDate.getTime());
            const to = open ? 100 : share(phase.endDate.getTime());
            return {
              status: phase.status,
              start: phase.startDate,
              end: open ? null : phase.endDate,
              left: `${from}%`,
              width: `${to - from}%`,
            };
          }),
      ]),
    ),
  };
};
