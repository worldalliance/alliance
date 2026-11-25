import { formatBadgeCount } from "@alliance/shared/lib/badgeCount";
import { cn } from "../ui/cn";
import type { QueueCount } from "./useQueueCounts";

/**
 * How many are waiting in a queue, read after the entry's name: nothing at
 * zero or while loading, "!" when the count couldn't load.
 */
export function CountBadge({
  count,
  className,
}: {
  count: QueueCount;
  className?: string;
}) {
  if (count === undefined) return null;
  const label = count === null ? "!" : formatBadgeCount(count);
  if (!label) return null;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft px-1.5 text-caption font-semibold text-accent tabular-nums",
          className,
        )}
      >
        {label}
      </span>
      <span className="sr-only">
        {" "}
        ({count === null ? "count couldn't load" : label})
      </span>
    </>
  );
}
