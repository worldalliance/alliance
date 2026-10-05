import { millisecondsInHour } from "date-fns/constants";

export function isAwayRangeActiveAt(
  range: { startDate: Date; endDate: Date },
  date: Date,
): boolean {
  return range.startDate <= date && date < range.endDate;
}

const AWAY_RANGE_UNDO_MS = millisecondsInHour;

/**
 * A range's start stays movable until it has begun and the hour after its
 * creation, in which a member can still undo it, has passed. A range that
 * starts before it was created gets no such hour.
 */
export function isAwayRangeStartLocked(
  range: { startDate: Date | string; createdAt: Date | string },
  now: Date = new Date(),
): boolean {
  const startMs = new Date(range.startDate).getTime();
  const createdMs = new Date(range.createdAt).getTime();
  return (
    startMs <= now.getTime() &&
    (startMs < createdMs || createdMs + AWAY_RANGE_UNDO_MS <= now.getTime())
  );
}

/** A range ending exactly now has ended. */
export function hasAwayRangeEnded(
  range: { endDate: Date | string },
  now: Date = new Date(),
): boolean {
  return new Date(range.endDate) <= now;
}
