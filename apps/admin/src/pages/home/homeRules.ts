import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { CountId } from "../../places";
import type { QueueCount } from "../../shell/useQueueCounts";
import type { DateRange } from "../../ui/templates/Overview";

const QUEUE_ORDER = [
  CountId.NeedsReply,
  CountId.WelcomeQueue,
  CountId.AwaitingGroup,
  CountId.PartnershipResponses,
] as const;

/**
 * The queues Home lists, in order: those with someone waiting, and those whose
 * count couldn't load (`null`), since a failed count is not an empty queue.
 * `null` until every count has settled, so the list appears once and whole.
 */
export function waitingQueues(
  counts: Record<CountId, QueueCount>,
): { id: CountId; count: number | null }[] | null {
  const queues: { id: CountId; count: number | null }[] = [];
  for (const id of QUEUE_ORDER) {
    const count = counts[id];
    if (count === undefined) return null;
    if (count === null || count > 0) queues.push({ id, count });
  }
  return queues;
}

export const lastDays = (days: number, now = new Date()): DateRange => {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return { start: dateToInputValue(start), end: dateToInputValue(now) };
};

export const lastMonths = (months: number, now = new Date()): DateRange => {
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  return { start: dateToInputValue(start), end: dateToInputValue(now) };
};

/** Why a range can't be requested, or `null`. */
export const invalidRangeMessage = (range: DateRange): string | null => {
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Enter a start date and an end date";
  }
  if (start > end) return "Choose a start date on or before the end date";
  return null;
};
