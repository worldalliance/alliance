import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { parseIsoDate } from "./parseIsoDate";

type DateRange = { start: string; end: string };

const parseLocalDateInput = (
  value?: string | null,
  endOfDay = false,
): Date | null => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const parsed = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWeekStartDate = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dayOfWeek = date.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return date;
};

export const cumulativeCompletionPoints = (
  actionStats: ActionStatsWithOnboardingDto[],
  range: DateRange,
  now: Date,
) => {
  const completedActions = actionStats
    .filter(
      (a) =>
        a.memberActionEndDate && a.showInChart && !a.onboarding && !a.optional,
    )
    .map((a) => ({
      ...a,
      endDate: new Date(a.memberActionEndDate!),
    }))
    .filter((a) => a.endDate <= now)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  if (completedActions.length === 0) return [];

  const rangeStart = parseLocalDateInput(range.start);
  const rangeEnd = parseLocalDateInput(range.end, true);
  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
    return [];
  }

  const dataPoints: {
    date: Date;
    avgRate: number;
    actionCount: number;
    actionNames: string[];
    dayKey: string;
  }[] = [];
  let runningSum = 0;
  let count = 0;

  for (const action of completedActions) {
    if (action.endDate < rangeStart) {
      runningSum += action.completionRate;
      count += 1;
      continue;
    }
    if (action.endDate > rangeEnd) break;

    runningSum += action.completionRate;
    count += 1;
    const dayKey = dateToInputValue(action.endDate);
    const existingPoint = dataPoints[dataPoints.length - 1];

    if (existingPoint && existingPoint.dayKey === dayKey) {
      // Keep one visual point per day, but preserve cumulative value
      // after all same-day actions have been included.
      existingPoint.date = action.endDate;
      existingPoint.avgRate = runningSum / count;
      existingPoint.actionCount = count;
      existingPoint.actionNames.push(action.actionName);
      continue;
    }

    dataPoints.push({
      date: action.endDate,
      avgRate: runningSum / count,
      actionCount: count,
      actionNames: [action.actionName],
      dayKey,
    });
  }

  return dataPoints.map(({ dayKey: _dayKey, ...point }) => point);
};

export const weeklyCompletionPoints = (
  actionStats: ActionStatsWithOnboardingDto[],
  range: DateRange,
  now: Date,
) => {
  const rangeStart = parseLocalDateInput(range.start);
  const rangeEnd = parseLocalDateInput(range.end, true);
  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
    return [];
  }

  const weeklyBuckets = new Map<
    string,
    {
      date: Date;
      actionCount: number;
      completedCount: number;
      joinedCount: number;
      actionNames: string[];
    }
  >();
  for (const action of actionStats) {
    if (
      !action.memberActionEndDate ||
      !action.showInChart ||
      action.onboarding ||
      action.optional
    ) {
      continue;
    }
    const endDate = parseIsoDate(action.memberActionEndDate);
    if (!endDate || endDate < rangeStart || endDate > rangeEnd) {
      continue;
    }

    const weekStart = getWeekStartDate(endDate);
    const bucketKey = dateToInputValue(weekStart);
    const existingBucket = weeklyBuckets.get(bucketKey) ?? {
      date: weekStart,
      actionCount: 0,
      completedCount: 0,
      joinedCount: 0,
      actionNames: [],
    };
    if (endDate > now) {
      continue;
    }

    existingBucket.actionCount += 1;
    existingBucket.completedCount += Math.max(0, action.usersCompleted);
    existingBucket.joinedCount += Math.max(0, action.usersJoined);
    existingBucket.actionNames.push(action.actionName);
    weeklyBuckets.set(bucketKey, existingBucket);
  }

  return Array.from(weeklyBuckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => ({
      date: bucket.date,
      weekRate:
        bucket.joinedCount > 0 ? bucket.completedCount / bucket.joinedCount : 0,
      actionCount: bucket.actionCount,
      completedCount: bucket.completedCount,
      joinedCount: bucket.joinedCount,
      actionNames: bucket.actionNames.sort((a, b) => a.localeCompare(b)),
    }));
};

/** A y-axis domain within [0, 1] padded around the finite rates; undefined without any. */
export const paddedRateDomain = (
  rates: number[],
): [number, number] | undefined => {
  const values = rates.filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return undefined;
  }
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(0, maxValue - minValue);
  const padding = Math.max(0.01, range * 0.1);
  let paddedMin = Math.max(0, minValue - padding);
  let paddedMax = Math.min(1, maxValue + padding);
  if (paddedMax === paddedMin) {
    const bump = Math.min(0.05, Math.max(0.01, paddedMax * 0.1));
    paddedMin = Math.max(0, paddedMin - bump);
    paddedMax = Math.min(1, paddedMax + bump);
  }
  return [paddedMin, paddedMax];
};
