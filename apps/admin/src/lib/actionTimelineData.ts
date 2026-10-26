import { memberActionPhase } from "@alliance/common/actionEvent";
import {
  ActionDto,
  ActionEventDto,
  ActionStatus,
  AdminActionDto,
  AdminActionListItemDto,
  ReminderGroupDto,
  ReminderGroupTimingMode,
} from "@alliance/shared/client";
import {
  addWeeks,
  isTuesday,
  milliseconds,
  nextTuesday,
  startOfDay,
} from "date-fns";
import { millisecondsInDay, millisecondsInSecond } from "date-fns/constants";

export type TimelineAction = Pick<
  ActionDto,
  "id" | "name" | "status" | "events" | "project"
> &
  Partial<Pick<AdminActionDto, "slug">> &
  Partial<Pick<AdminActionListItemDto, "variantFormIds">>;

export const TIMELINE_ROW_HEIGHT = 80;

const MAX_TIMELINE_STRIPES = 5;

export const timelineStripeCount = (
  action: Pick<TimelineAction, "variantFormIds">,
) => Math.min(MAX_TIMELINE_STRIPES, 1 + (action.variantFormIds?.length ?? 0));

export type TimelineReminder = Pick<
  ReminderGroupDto,
  | "id"
  | "name"
  | "timingMode"
  | "send_range_start"
  | "send_range_end"
  | "sendAtAbsolute"
  | "sendAtSecondsFromDeadline"
  | "memberActionEvent"
>;

interface TimelineData {
  action: Pick<
    TimelineAction,
    "id" | "name" | "slug" | "status" | "project" | "variantFormIds"
  >;
  phases: PhaseSegment[];
  totalDuration: number;
  startDate: Date;
  endDate: Date;
  launchTime: number;
}

export type TimelineRow = Pick<TimelineData, "action" | "phases">;

export interface PhaseSegment {
  status: ActionStatus;
  startDate: Date;
  endDate: Date;
  duration: number;
  event?: ActionEventDto;
  isActive: boolean;
}

export interface NormalizedReminder {
  id: number;
  label?: string | null;
  startDate: Date;
  endDate: Date;
  isRange: boolean;
  timingMode: ReminderGroupTimingMode;
  original: TimelineReminder;
}

const SHOWS_BAR: Record<ActionStatus, boolean> = {
  draft: true,
  planned: true,
  office_action: true,
  member_action: true,
  resolution: true,
  completed: false,
  failed: true,
  abandoned: true,
};

export const launchTime = (events: ActionEventDto[]): number => {
  const { event } = memberActionPhase(events);
  return event ? new Date(event.date).getTime() : -Infinity;
};

export const parseReminderDate = (value: unknown): Date | null => {
  if (!value && value !== 0) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const eventsByDate = (events: ActionEventDto[]) =>
  [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

const deadlineEventsByMemberEventId = (actions: TimelineAction[]) => {
  const deadlineEvents = new Map<number, ActionEventDto>();
  for (const action of actions) {
    const { event, deadlineEvent } = memberActionPhase(action.events);
    if (event && deadlineEvent) {
      deadlineEvents.set(event.id, deadlineEvent);
    }
  }
  return deadlineEvents;
};

export const normalizeReminders = (
  reminderList: TimelineReminder[],
  actions: TimelineAction[],
): NormalizedReminder[] => {
  if (!reminderList || reminderList.length === 0) {
    return [];
  }

  const deadlineEventById = deadlineEventsByMemberEventId(actions);

  return reminderList
    .map<NormalizedReminder | null>((reminder) => {
      const timingMode = reminder.timingMode;

      const rangeStart = parseReminderDate(reminder.send_range_start) ?? null;

      const rangeEnd = parseReminderDate(reminder.send_range_end) ?? null;

      let singleDate = parseReminderDate(reminder.sendAtAbsolute) ?? null;

      const isRangeTiming = timingMode === "within_range";

      if (!singleDate) {
        const offsetSeconds = reminder.sendAtSecondsFromDeadline;

        if (offsetSeconds != null && timingMode === "from_deadline") {
          let deadlineDate: Date | null = null;

          const memberEventId = reminder.memberActionEvent?.id;

          if (!deadlineDate && memberEventId != null) {
            const deadlineEvent = deadlineEventById.get(memberEventId);
            if (deadlineEvent) {
              deadlineDate = parseReminderDate(deadlineEvent.date);
            }
          }

          if (deadlineDate) {
            singleDate = new Date(
              deadlineDate.getTime() - offsetSeconds * millisecondsInSecond,
            );
          }
        } else if (timingMode === "event_launch") {
          if (reminder.memberActionEvent) {
            singleDate = parseReminderDate(reminder.memberActionEvent.date);
          }
        }
      }

      if (rangeStart && rangeEnd) {
        const start =
          rangeStart.getTime() <= rangeEnd.getTime() ? rangeStart : rangeEnd;
        const end =
          rangeStart.getTime() <= rangeEnd.getTime() ? rangeEnd : rangeStart;

        return {
          id: reminder.id,
          label: reminder.name,
          startDate: start,
          endDate: end,
          isRange: true,
          timingMode,
          original: reminder,
        };
      }

      if (singleDate) {
        return {
          id: reminder.id,
          label: reminder.name,
          startDate: singleDate,
          endDate: singleDate,
          isRange: isRangeTiming,
          timingMode,
          original: reminder,
        };
      }

      if (rangeStart || rangeEnd) {
        const fallbackDate = rangeStart ?? rangeEnd;
        if (!fallbackDate) {
          return null;
        }

        return {
          id: reminder.id,
          label: reminder.name,
          startDate: fallbackDate,
          endDate: fallbackDate,
          isRange: false,
          timingMode,
          original: reminder,
        };
      }

      return null;
    })
    .filter((entry): entry is NormalizedReminder => entry !== null)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
};

export const buildTimelineData = ({
  actions,
  normalizedReminders,
  latestLaunchFirst,
}: {
  actions: TimelineAction[];
  normalizedReminders: NormalizedReminder[];
  latestLaunchFirst: boolean;
}) => {
  const processedActions: TimelineData[] = [];

  for (const action of actions) {
    if (!action.events || action.events.length === 0) {
      continue;
    }

    const sortedEvents = eventsByDate(action.events);

    const phases: PhaseSegment[] = [];

    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];

      const phaseStartDate = new Date(event.date);
      const phaseEndDate = nextEvent
        ? new Date(nextEvent.date)
        : new Date(Date.now() + milliseconds({ days: 7 }));

      const duration = phaseEndDate.getTime() - phaseStartDate.getTime();

      phases.push({
        status: event.newStatus,
        startDate: phaseStartDate,
        endDate: phaseEndDate,
        duration,
        event,
        isActive:
          i === sortedEvents.length - 1 && action.status === event.newStatus,
      });
    }

    if (phases.length > 0) {
      const totalDuration =
        phases[phases.length - 1].endDate.getTime() -
        phases[0].startDate.getTime();

      processedActions.push({
        action,
        phases,
        totalDuration,
        startDate: phases[0].startDate,
        endDate: phases[phases.length - 1].endDate,
        launchTime: launchTime(action.events),
      });
    }
  }

  const sortedActions = processedActions.sort((a, b) =>
    latestLaunchFirst
      ? b.launchTime - a.launchTime
      : a.startDate.getTime() - b.startDate.getTime(),
  );

  const boundaryTimestamps: number[] = [];

  sortedActions.forEach((item) => {
    boundaryTimestamps.push(item.startDate.getTime(), item.endDate.getTime());
  });

  normalizedReminders.forEach((reminder) => {
    boundaryTimestamps.push(reminder.startDate.getTime());
    if (reminder.isRange) {
      boundaryTimestamps.push(reminder.endDate.getTime());
    }
  });
  actions.forEach((action) => {
    action.events.forEach((event) => {
      boundaryTimestamps.push(new Date(event.date).getTime());
    });
  });

  const defaultPadding = milliseconds({ days: 1 });
  let minDate: Date;
  let maxDate: Date;

  if (boundaryTimestamps.length > 0) {
    const minTime = Math.min(...boundaryTimestamps);
    const maxTime = Math.max(...boundaryTimestamps);
    minDate = new Date(minTime - defaultPadding);
    maxDate = new Date(maxTime + defaultPadding);
  } else {
    const now = new Date();
    minDate = new Date(now.getTime() - defaultPadding);
    maxDate = new Date(now.getTime() + defaultPadding);
  }

  const globalStartDate = new Date(
    Math.min(minDate.getTime(), Date.now() - milliseconds({ days: 2 })),
  );

  const span = maxDate.getTime() - globalStartDate.getTime();
  const dayCount = Math.max(1, Math.ceil(span / millisecondsInDay));

  return {
    timelineData: [
      ...sortedActions,
      ...actions
        .filter((action) => !action.events?.length)
        .map((action) => ({ action, phases: [] })),
    ] satisfies TimelineRow[],
    globalStartDate,
    globalEndDate: maxDate,
    totalDays: dayCount,
  };
};

// globalStartDate falls at an arbitrary time of day, so ticks anchor to
// midnight rather than to it.
export const weekTicks = ({
  globalStartDate,
  globalEndDate,
  pixelsPerDay,
}: {
  globalStartDate: Date;
  globalEndDate: Date;
  pixelsPerDay: number;
}) => {
  const pixelsPerMillisecond = pixelsPerDay / millisecondsInDay;
  const firstDay = startOfDay(globalStartDate);
  const ticks: { date: Date; left: number }[] = [];

  let current = isTuesday(firstDay) ? firstDay : nextTuesday(firstDay);

  while (current <= globalEndDate) {
    ticks.push({
      date: current,
      left:
        (current.getTime() - globalStartDate.getTime()) * pixelsPerMillisecond,
    });
    current = addWeeks(current, 1);
  }

  return ticks;
};

export const firstRowActiveInWeek = (
  timelineData: TimelineRow[],
  weekStart: Date,
) => {
  const weekEnd = addWeeks(weekStart, 1);
  return timelineData.findIndex(({ phases }) =>
    phases.some(
      (phase) =>
        SHOWS_BAR[phase.status] &&
        startOfDay(phase.startDate) < weekEnd &&
        startOfDay(phase.endDate) > weekStart,
    ),
  );
};
