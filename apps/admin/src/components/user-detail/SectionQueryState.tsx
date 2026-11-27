import { cn } from "../../ui/cn";

export function SectionLoadState({
  noun,
  isError,
}: {
  noun: string;
  isError: boolean;
}) {
  return (
    <p className={isError ? "text-danger" : "text-fg-muted"}>
      {isError ? `Failed to load ${noun}` : `Loading ${noun}...`}
    </p>
  );
}

/** Stays mounted so screen readers announce the text when it appears. */
export function SectionRefreshError({
  noun,
  isError,
  className,
}: {
  noun: string;
  isError: boolean;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn("text-caption text-danger", isError && "mb-2", className)}
    >
      {isError && `Could not refresh ${noun}. Reload to see the latest.`}
    </p>
  );
}
