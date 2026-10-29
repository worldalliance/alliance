import { cn } from "@alliance/shared/styles/util";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

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
        "flex cursor-pointer list-none items-center gap-1 rounded px-1 py-1 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden",
        summaryClassName,
      )}
    >
      <ChevronRight
        className="size-4 shrink-0 text-zinc-500 transition-transform group-open/disclosure:rotate-90"
        aria-hidden
      />
      {summary}
    </summary>
    {children}
  </details>
);

export default Disclosure;
