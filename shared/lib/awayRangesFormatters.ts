import { isAwayRangeActiveAt } from "@alliance/common/awayRange";
import type { Assert, Equal } from "@alliance/common/types";
import type { UserAwayRangeDto, UserAwayRangeReason } from "../client";
import { formatShortDate } from "./dateFormatters";

export const AWAY_REASON_LABELS = {
  vacation: "Vacation",
  emergency: "Emergency",
  other: "Other",
} satisfies Record<UserAwayRangeReason, string>;

const AWAY_REASONS = ["vacation", "emergency", "other"] as const;
type _typecheck = Assert<
  Equal<(typeof AWAY_REASONS)[number], UserAwayRangeReason>
>;

export const AWAY_REASON_OPTIONS = AWAY_REASONS.map((value) => ({
  value,
  label: AWAY_REASON_LABELS[value],
}));

export enum AwayRangeStatus {
  Current = "current",
  Upcoming = "upcoming",
  Past = "past",
}

export function awayRangeStatus(
  range: Pick<UserAwayRangeDto, "startDate" | "endDate">,
  now = new Date(),
): AwayRangeStatus {
  const startDate = new Date(range.startDate);
  if (startDate > now) return AwayRangeStatus.Upcoming;
  return isAwayRangeActiveAt(
    { startDate, endDate: new Date(range.endDate) },
    now,
  )
    ? AwayRangeStatus.Current
    : AwayRangeStatus.Past;
}

export function formatAwayRange(range: UserAwayRangeDto): string {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export function formatAwayReason(reason: UserAwayRangeReason): string {
  return AWAY_REASON_LABELS[reason];
}
