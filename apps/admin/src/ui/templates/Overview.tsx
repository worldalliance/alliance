import type { ReactNode } from "react";
import { cn } from "../cn";

/** A group of cards on an Overview, under a muted label. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** A link to the List holding the full data, or a control for the section. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-control-sm items-center justify-between gap-3">
        <h2 className="text-caption font-medium text-fg-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Twelve columns. Children take their share with `col-span-*`. */
export function OverviewGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-12 gap-section">{children}</div>;
}

/**
 * A card with a header row: a table, a chart or a list with its title. `flush`
 * drops the body's padding for a table or a row list.
 */
export function Panel({
  title,
  description,
  action,
  flush = false,
  className,
  children,
}: {
  title: string;
  /** Muted, beside the title. */
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  /** For `col-span-*` in an `OverviewGrid`. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-line px-card py-2">
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <span className="text-caption text-fg-muted">{description}</span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={cn("min-w-0", flush ? "overflow-x-auto" : "p-card")}>
        {children}
      </div>
    </section>
  );
}

/** A label and a number the server provides. No deltas or sparklines. */
export function StatTile({
  label,
  value,
  note,
  className,
}: {
  label: string;
  /** Formatted; "—" when the server has no value. */
  value: string;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-card border border-line bg-surface p-card",
        className,
      )}
    >
      <span className="text-caption font-medium text-fg-muted">{label}</span>
      <span className="mt-1.5 text-stat font-semibold tabular-nums">
        {value}
      </span>
      {note && <span className="text-caption text-fg-muted">{note}</span>}
    </div>
  );
}
