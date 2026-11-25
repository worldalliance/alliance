import { DropPosition } from "../../lib/useDragReorder";
import { cn } from "../../ui/cn";

/** Where a drop lands: a line over the gap, laid out over the content so nothing moves. */
export function DropLine({
  position,
  before,
  after,
}: {
  position: DropPosition;
  before: string;
  after: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 h-0.5 rounded-full bg-accent",
        position === DropPosition.Before ? before : after,
      )}
    />
  );
}
