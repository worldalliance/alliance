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

export function SectionRefreshError({ noun }: { noun: string }) {
  return (
    <p className="text-xs text-red-600 mb-2">
      Could not refresh {noun}. Reload to see the latest.
    </p>
  );
}
