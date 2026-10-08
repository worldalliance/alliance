import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react";

export const ACCORDION_SECTIONS =
  "border-y border-gray-200 divide-y divide-gray-200";

export const ACCORDION_TITLE = "font-medium text-zinc-900";

export const ACCORDION_CONTENTS = "flex flex-col gap-3 pb-4";

/** Points down, and up once `className` rotates it for an open section. */
export function AccordionChevron({ className }: { className?: string }) {
  return (
    <ChevronDown
      size={18}
      aria-hidden="true"
      className={cn("shrink-0 text-zinc-500 transition-transform", className)}
    />
  );
}
