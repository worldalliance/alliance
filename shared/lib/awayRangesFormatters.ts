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

export function formatAwayRange(range: UserAwayRangeDto): string {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export function formatAwayReason(reason: UserAwayRangeReason): string {
  return AWAY_REASON_LABELS[reason];
}
