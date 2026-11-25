import { ChevronRight } from "lucide-react";
import type React from "react";
import { formatCount } from "../lib/formatNumber";
import { cn } from "./cn";
import { zIndex } from "./zIndex";

type TableProps = React.ComponentProps<"table"> & {
  /**
   * For a table that is the page's body, edge to edge: its first and last
   * columns take the page margin, so the first column lines up with the title.
   */
  bleed?: boolean;
};

function Table({ className, bleed = false, ...props }: TableProps) {
  return (
    <table
      data-bleed={bleed ? "" : undefined}
      className={cn(
        "group/table w-full border-separate border-spacing-0 text-left",
        className,
      )}
      {...props}
    />
  );
}

function TableHeader(props: React.ComponentProps<"thead">) {
  return <thead {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("*:not-aria-selected:hover:bg-surface-2", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("group/row aria-selected:bg-accent-soft", className)}
      {...props}
    />
  );
}

const BLEED_EDGES =
  "group-data-bleed/table:first:pl-page group-data-bleed/table:last:pr-page";

function TableHead({
  className,
  actions = false,
  children,
  ...props
}: React.ComponentProps<"th"> & {
  /** The column of row actions: its name ("Actions") is for screen readers only. */
  actions?: boolean;
}) {
  return (
    <th
      className={cn(
        zIndex.raised,
        "sticky top-0 h-th border-b border-line bg-surface-2 px-cell text-caption font-medium whitespace-nowrap text-fg-muted",
        BLEED_EDGES,
        className,
      )}
      {...props}
    >
      {actions ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

function TableCell({
  className,
  actions = false,
  truncate = false,
  title,
  children,
  ...props
}: React.ComponentProps<"td"> & {
  /** The row's buttons, at the row's end. */
  actions?: boolean;
  /**
   * A text column that takes the row's spare width (shared with any
   * other truncated column) and cuts the rest with an ellipsis. Text given as
   * a string is also the cell's tooltip; pass `title` for anything else.
   */
  truncate?: boolean;
}) {
  return (
    <td
      data-truncate={truncate ? "" : undefined}
      className={cn(
        "h-row border-b border-line px-cell group-last/row:border-b-0 group-data-bleed/table:group-last/row:border-b",
        BLEED_EDGES,
        // The other columns fit their content on one line, so the spare
        // width goes to the truncated ones, whose own content asks for none.
        truncate
          ? "max-w-0 truncate"
          : "group-has-[[data-truncate]]/table:w-px group-has-[[data-truncate]]/table:whitespace-nowrap",
        actions && "whitespace-nowrap",
        className,
      )}
      title={
        title ??
        (truncate && typeof children === "string" ? children : undefined)
      }
      {...props}
    >
      {actions ? (
        <div className="flex items-center justify-end gap-2">{children}</div>
      ) : (
        children
      )}
    </td>
  );
}

/**
 * A heading row between groups of rows in one table: "Active", with its count.
 * It never takes the row hover, so it can't be mistaken for a row.
 */
function TableGroupRow({
  colSpan,
  label,
  count,
}: {
  /** The table's column count. */
  colSpan: number;
  /** The group's name; a group that is a status passes its badge. */
  label: React.ReactNode;
  count?: number;
}) {
  return (
    <tr>
      <th
        colSpan={colSpan}
        scope="rowgroup"
        className={cn(
          "h-th border-b border-line bg-canvas px-cell text-left font-semibold",
          BLEED_EDGES,
        )}
      >
        <span className="flex items-center gap-2">
          {label}
          {count !== undefined && (
            <span className="text-caption font-medium text-fg-muted tabular-nums">
              {formatCount(count)}
            </span>
          )}
        </span>
      </th>
    </tr>
  );
}

/**
 * The control in a row that opens its `TableDetailRow`. Its children are the
 * visible words: what the detail holds ("12 members").
 */
function ExpandToggle({
  expanded,
  controls,
  onToggle,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "onClick" | "type"> & {
  expanded: boolean;
  /** The `id` given to the `TableDetailRow`. */
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      onClick={onToggle}
      className="-ml-1.5 inline-flex h-control-sm items-center gap-1 rounded-md px-1.5 font-medium whitespace-nowrap focus-ring hover:bg-line"
      {...props}
    >
      <ChevronRight
        aria-hidden="true"
        className={cn(
          "size-4 text-fg-muted transition-transform duration-fast",
          expanded && "rotate-90",
        )}
      />
      {children}
    </button>
  );
}

/**
 * What a row expands to, directly under it, mounted only while open. As tall
 * as its content; its opaque cell keeps the row hover off it. Its children
 * stack 12 px apart.
 */
function TableDetailRow({
  id,
  colSpan,
  children,
}: {
  id: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr id={id}>
      <td
        colSpan={colSpan}
        className={cn(
          "border-b border-line bg-surface px-cell pt-1 pb-4",
          BLEED_EDGES,
        )}
      >
        <div className="flex flex-col gap-3">{children}</div>
      </td>
    </tr>
  );
}

export {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableDetailRow,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
};
