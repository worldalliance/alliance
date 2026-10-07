import { cn } from "@alliance/shared/styles/util";
import { DropPosition } from "../../lib/useDragReorder";

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
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 h-0.5 rounded-full bg-blue-500",
        position === DropPosition.Before ? before : after,
      )}
    />
  );
}
