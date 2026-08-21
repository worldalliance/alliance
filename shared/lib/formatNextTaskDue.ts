import { formatDistance } from "date-fns";

/**
 * Returns human-readable "next task due" text: either relative time (e.g. "in 2 days")
 * or "Complete" when there is no finite deadline.
 */
export function formatNextTaskDue(
  deadlineTimestamp: number | undefined,
): string {
  if (deadlineTimestamp == null || !Number.isFinite(deadlineTimestamp)) {
    return "Complete";
  }
  return formatDistance(new Date(deadlineTimestamp), new Date(), {
    addSuffix: true,
  });
}
