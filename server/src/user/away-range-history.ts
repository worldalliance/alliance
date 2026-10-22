import {
  hasAwayRangeEnded,
  isAwayRangeStartLocked,
} from "@alliance/common/awayRange";
import { R, type Result } from "@alliance/common/result";
import { milliseconds } from "date-fns";
import type { UserAwayRange } from "./entities/user-away-range.entity";

export enum AwayRangeEditor {
  Member = "member",
  Admin = "admin",
}

/** Lets a range start on the current day in any time zone. */
const AWAY_RANGE_START_TOLERANCE_MS = milliseconds({ hours: 36 });

export function checkAwayRangeStart(
  startDate: Date,
  now: Date,
): Result<Date, string> {
  return startDate.getTime() + AWAY_RANGE_START_TOLERANCE_MS < now.getTime()
    ? R.failure("Start date must be in the future.")
    : R.success(startDate);
}

const PAST_END_MESSAGE = "An away period can't end in the past.";

export type AwayRangeSpan = Pick<UserAwayRange, "startDate" | "endDate">;

export type StoredAwayRange = AwayRangeSpan & Pick<UserAwayRange, "createdAt">;

/**
 * The span a member's create (`before: null`) or edit saves. Assignments for
 * actions that already ran read away ranges live, so the part of a range
 * before `now` is history only staff may change: a range never starts before
 * `now`, and once its start locks it keeps its start and its elapsed time.
 */
export function applyMemberAwayRangeEdit(params: {
  before: StoredAwayRange | null;
  requested: AwayRangeSpan;
  now: Date;
}): Result<AwayRangeSpan, string> {
  const { before, requested, now } = params;
  if (!before || !isAwayRangeStartLocked(before, now)) {
    if (
      before &&
      requested.startDate.getTime() === before.startDate.getTime()
    ) {
      return R.success(requested);
    }
    if (requested.endDate <= now) {
      return R.failure(PAST_END_MESSAGE);
    }
    return R.map(
      checkAwayRangeStart(requested.startDate, now),
      (startDate) => ({
        startDate: startDate < now ? now : startDate,
        endDate: requested.endDate,
      }),
    );
  }
  if (requested.startDate.getTime() !== before.startDate.getTime()) {
    return R.failure("An away period that has begun can't change its start.");
  }
  if (hasAwayRangeEnded(before, now)) {
    return requested.endDate.getTime() === before.endDate.getTime()
      ? R.success(requested)
      : R.failure("An away period that has ended can't be changed.");
  }
  return requested.endDate < now
    ? R.failure(PAST_END_MESSAGE)
    : R.success(requested);
}
