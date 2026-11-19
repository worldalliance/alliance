import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, ChevronRight } from "lucide-react";
import type React from "react";
import { useId, useState } from "react";

type SectionProps = {
  title: string;
  /** Sits beside the title, such as a count. */
  meta?: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header: the section's buttons or report parameters. */
  actions?: React.ReactNode;
  collapsible?: { defaultOpen: boolean };
  className?: string;
  children: React.ReactNode;
};

const Section = ({
  title,
  meta,
  description,
  actions,
  collapsible,
  className,
  children,
}: SectionProps) => {
  const headingId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(collapsible?.defaultOpen ?? true);
  const heading = (
    <>
      {title}
      {meta !== undefined && (
        <>
          {" "}
          <span className="ml-1 font-normal text-zinc-500">{meta}</span>
        </>
      )}
    </>
  );
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-md border border-zinc-200 bg-white", className)}
    >
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3",
          open && "border-b border-zinc-200",
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-sm font-semibold text-zinc-900">
            {collapsible ? (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? bodyId : undefined}
                onClick={() => setOpen(!open)}
                className="-mx-1 flex items-center gap-1 rounded-md px-1 outline-hidden hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {open ? (
                  <ChevronDown size={14} aria-hidden />
                ) : (
                  <ChevronRight size={14} aria-hidden />
                )}
                {heading}
              </button>
            ) : (
              heading
            )}
          </h2>
          {description && (
            <p className="text-sm text-zinc-600">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>
      {open && (
        <div id={bodyId} className="p-4">
          {children}
        </div>
      )}
    </section>
  );
};

export default Section;
