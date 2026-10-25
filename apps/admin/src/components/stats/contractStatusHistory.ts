import type { ContractStatusPointDto } from "@alliance/shared/client/types.gen";
import { millisecondsInDay } from "date-fns/constants";

export type ParsedContractStatusPoint = ContractStatusPointDto & {
  parsedDate: Date;
};

const findContractStatusPointDaysAgo = (
  history: ParsedContractStatusPoint[],
  daysAgo: number,
): ParsedContractStatusPoint | null => {
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const targetDate = new Date(latest.parsedDate);
  targetDate.setDate(targetDate.getDate() - daysAgo);

  let closest = history[0];
  for (const point of history) {
    if (point.parsedDate <= targetDate) {
      closest = point;
    } else {
      break;
    }
  }

  const daysBetween =
    (latest.parsedDate.getTime() - closest.parsedDate.getTime()) /
    millisecondsInDay;
  if (daysBetween < daysAgo - 2) return null;

  return closest;
};

/**
 * Percent of the members active 30 days before the latest point who have
 * churned since; null when the history doesn't reach that far back or no one
 * was active then.
 */
export const monthlyChurnRate = (
  history: ParsedContractStatusPoint[],
): number | null => {
  const latest = history[history.length - 1];
  if (!latest) return null;

  const monthAgo = findContractStatusPointDaysAgo(history, 30);
  if (!monthAgo || monthAgo.activeCount <= 0) return null;

  const churnedInPeriod = Math.max(
    0,
    latest.churnedCount - monthAgo.churnedCount,
  );
  return (churnedInPeriod / monthAgo.activeCount) * 100;
};
