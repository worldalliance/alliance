import { cn } from "../../../ui/cn";
import { Skeleton } from "../../../ui/Skeleton";
import { FormSkeleton } from "../../../ui/templates/States";
import { useDelayedFlag } from "../../../ui/templates/useDelayedFlag";

const BLOCK_HEIGHTS = ["h-10", "h-24", "h-16", "h-32", "h-20"] as const;

/** Over the canvas while its page settles, shown only if that takes a moment. */
export function CanvasSkeleton() {
  const show = useDelayedFlag(true);
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("absolute inset-0 p-4", !show && "invisible")}
    >
      <div className="mx-auto flex w-full max-w-160 flex-col gap-6 rounded-card border border-line bg-surface px-8 py-8">
        <Skeleton className="h-7 w-2/3" />
        {BLOCK_HEIGHTS.map((height, index) => (
          <Skeleton key={index} className={cn("w-full", height)} />
        ))}
      </div>
    </div>
  );
}

/** The outline's rows while the form loads. */
export function OutlineSkeleton() {
  const show = useDelayedFlag(true);
  return (
    <div
      aria-hidden="true"
      className={cn("flex flex-col gap-3 p-4", !show && "invisible")}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** The inspector's header and fields while the form loads. */
export function InspectorSkeleton() {
  const show = useDelayedFlag(true);
  return (
    <div
      aria-hidden="true"
      className={cn("flex flex-col gap-4 p-4", !show && "invisible")}
    >
      <Skeleton className="h-5 w-40" />
      <FormSkeleton />
    </div>
  );
}
