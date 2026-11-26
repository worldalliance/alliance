import { Eye } from "lucide-react";
import type { MouseEvent } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";

/**
 * The line under a conditionally shown item saying when members see it, in
 * words; it opens the item's Conditions. It is there whenever the item has
 * conditions, so only editing them adds or removes it.
 */
export function ConditionsIndicator({
  label,
  summary,
  onClick,
  className,
}: {
  label: string;
  /** The rule in words, after "Shown when". */
  summary: string;
  onClick: (event: MouseEvent) => void;
  className?: string;
}) {
  return (
    <Button
      variant={ButtonVariant.Ghost}
      size="small"
      onClick={onClick}
      aria-label={label}
      title={`Shown when ${summary}`}
      className={cn(
        "relative max-w-full text-caption text-fg-muted",
        className,
      )}
    >
      <Eye aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">Shown when {summary}</span>
    </Button>
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
      summary={summary}
      className="-ml-2 mt-1"
    />
  );
}
