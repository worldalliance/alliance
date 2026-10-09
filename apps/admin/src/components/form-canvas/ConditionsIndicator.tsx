import { cn } from "@alliance/shared/styles/util";
import { Eye } from "lucide-react";
import type { MouseEvent } from "react";

/** The canvas marker on a conditionally shown target, opening its Conditions. */
export function ConditionsIndicator({
  label,
  title,
  onClick,
  className,
}: {
  label: string;
  title: string;
  onClick: (event: MouseEvent) => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        className,
      )}
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

export function ElementConditionsIndicator({
  summary,
  onOpen,
}: {
  summary: string;
  onOpen: () => void;
}) {
  return (
    <ConditionsIndicator
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      label={`Edit conditions: shown when ${summary}`}
      title={`Shown when ${summary}`}
      className="absolute -right-2 -top-2 z-10 shadow-sm"
    />
  );
}
