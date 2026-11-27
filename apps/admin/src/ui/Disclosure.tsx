import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * A section the reader shows or hides, closed unless `defaultOpen`: a native
 * `<details>`, so the browser handles the keyboard and find-in-page opens it.
 * Its summary leads with a chevron, as `ExpandToggle` does in a table.
 */
export function Disclosure({
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("group", className)}>
      <summary className="-ml-1.5 inline-flex h-control-sm cursor-default list-none items-center gap-1 rounded-md px-1.5 font-medium focus-ring hover:bg-line [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-fg-muted transition-transform duration-fast [details[open]>summary>&]:rotate-90"
        />
        {summary}
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}
