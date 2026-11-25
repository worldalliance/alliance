import { cn } from "@alliance/shared/styles/util";

export function SectionLoadState({
  noun,
  isError,
}: {
  noun: string;
  isError: boolean;
}) {
  return (
    <p className={cn("text-sm", isError ? "text-red-600" : "text-zinc-500")}>
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
      className={cn("text-xs text-red-600", isError && "mb-2", className)}
    >
      {isError && `Could not refresh ${noun}. Reload to see the latest.`}
    </p>
  );
}
