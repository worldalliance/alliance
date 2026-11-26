import { Info } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "./cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

/**
 * A small info button beside a label, heading or value, showing `children`
 * on hover and on keyboard focus, and read to a screen reader as the
 * button's description. For a fact that explains what it sits beside; each
 * one is a tab stop, so not one per table row.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** The button's accessible name, naming what is explained: "About When". */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const descriptionId = useId();
  return (
    <Tooltip disableHoverablePopup={false}>
      <TooltipTrigger
        closeOnClick={false}
        aria-label={label}
        aria-describedby={descriptionId}
        className={cn(
          "inline-grid size-5 shrink-0 place-items-center rounded-sm align-middle text-fg-muted focus-ring hover:text-fg",
          className,
        )}
      >
        <Info aria-hidden="true" className="size-3.5" />
        <span id={descriptionId} className="sr-only">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs font-normal whitespace-normal">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
