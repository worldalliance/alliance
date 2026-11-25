import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../ui/cn";

/** A summary line that opens to its detail in place, below it. */
const Disclosure = ({
  summary,
  summaryClassName,
  children,
}: {
  summary: ReactNode;
  summaryClassName?: string;
  children: ReactNode;
}) => (
  <details className="group/disclosure">
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors duration-fast hover:bg-surface-2 focus-ring [&::-webkit-details-marker]:hidden",
        summaryClassName,
      )}
    >
      <ChevronRight
        className="size-4 shrink-0 text-fg-muted transition-transform duration-base group-open/disclosure:rotate-90 motion-reduce:transition-none"
        aria-hidden
      />
      {summary}
    </summary>
    {children}
  </details>
);

export default Disclosure;
