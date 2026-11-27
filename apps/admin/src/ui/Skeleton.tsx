import { cn } from "./cn";

/** A placeholder in the shape of content still loading. Size it with classes. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-line motion-safe:animate-pulse", className)}
    />
  );
}
