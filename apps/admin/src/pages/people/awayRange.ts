import type { UserAwayRangeDto } from "@alliance/shared/client/types.gen";

function formatAwayDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAwayRange(range: UserAwayRangeDto) {
  return `${formatAwayDate(range.startDate)} to ${formatAwayDate(
    range.endDate,
  )}`;
}
