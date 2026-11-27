import type { UserAwayRangeDto } from "@alliance/shared/client/types.gen";
import { formatDate } from "../../lib/formatDate";

/** "Feb 1 to Feb 5", with a year only where it isn't this year. */
export function formatAwayRange(range: UserAwayRangeDto) {
  return `${formatDate(range.startDate)} to ${formatDate(range.endDate)}`;
}
