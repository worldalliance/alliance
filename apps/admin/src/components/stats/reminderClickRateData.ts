import type { ReminderGroupClickRatePoint } from "../../lib/useReminderGroupClickRatesAdmin";
import { parseIsoDate } from "./parseIsoDate";

export enum ReminderChannel {
  Email = "email",
  Text = "text",
}

export const reminderChannels = Object.values(ReminderChannel);

export type ReminderActionChannelBar = {
  actionId: number;
  actionName: string;
  averageRate: number;
  reminderGroupCount: number;
  sentCount: number;
  clickedCount: number;
};

export const pointsInRange = (
  points: ReminderGroupClickRatePoint[],
  range: { start: string; end: string },
): ReminderGroupClickRatePoint[] => {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (!start || !end) {
    return points;
  }
  if (start > end) {
    return [];
  }
  const rangeStart = new Date(start);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);

  return points.filter(
    (point) => point.date >= rangeStart && point.date <= rangeEnd,
  );
};

export const reminderActionAggregates = (
  points: ReminderGroupClickRatePoint[],
) => {
  const byAction = new Map<
    number,
    {
      actionId: number;
      actionName: string;
      mostRecentDateMs: number;
      emailGroupCount: number;
      emailSentCount: number;
      emailClickedCount: number;
      textGroupCount: number;
      textSentCount: number;
      textClickedCount: number;
    }
  >();

  for (const point of points) {
    const existing = byAction.get(point.actionId) ?? {
      actionId: point.actionId,
      actionName: point.actionName,
      mostRecentDateMs: point.date.getTime(),
      emailGroupCount: 0,
      emailSentCount: 0,
      emailClickedCount: 0,
      textGroupCount: 0,
      textSentCount: 0,
      textClickedCount: 0,
    };

    existing.mostRecentDateMs = Math.max(
      existing.mostRecentDateMs,
      point.date.getTime(),
    );

    if (point.emailSentCount > 0) {
      existing.emailGroupCount += 1;
      existing.emailSentCount += point.emailSentCount;
      existing.emailClickedCount += point.emailClickedCount;
    }
    if (point.textSentCount > 0) {
      existing.textGroupCount += 1;
      existing.textSentCount += point.textSentCount;
      existing.textClickedCount += point.textClickedCount;
    }

    byAction.set(point.actionId, existing);
  }

  return Array.from(byAction.values()).sort((a, b) => {
    if (a.mostRecentDateMs !== b.mostRecentDateMs) {
      return a.mostRecentDateMs - b.mostRecentDateMs;
    }
    return a.actionName.localeCompare(b.actionName);
  });
};

type ReminderActionAggregate = ReturnType<
  typeof reminderActionAggregates
>[number];

const channelCounts: Record<
  ReminderChannel,
  (aggregate: ReminderActionAggregate) => {
    groupCount: number;
    sentCount: number;
    clickedCount: number;
  }
> = {
  [ReminderChannel.Email]: (aggregate) => ({
    groupCount: aggregate.emailGroupCount,
    sentCount: aggregate.emailSentCount,
    clickedCount: aggregate.emailClickedCount,
  }),
  [ReminderChannel.Text]: (aggregate) => ({
    groupCount: aggregate.textGroupCount,
    sentCount: aggregate.textSentCount,
    clickedCount: aggregate.textClickedCount,
  }),
};

/** Each action reminded over the channel, with its click rate pooled across its reminder groups. */
export const channelBars = (
  aggregates: ReminderActionAggregate[],
  channel: ReminderChannel,
): ReminderActionChannelBar[] =>
  aggregates.flatMap((aggregate) => {
    const { groupCount, sentCount, clickedCount } =
      channelCounts[channel](aggregate);
    if (groupCount === 0) return [];
    return [
      {
        actionId: aggregate.actionId,
        actionName: aggregate.actionName,
        averageRate: sentCount > 0 ? clickedCount / sentCount : 0,
        reminderGroupCount: groupCount,
        sentCount,
        clickedCount,
      },
    ];
  });
