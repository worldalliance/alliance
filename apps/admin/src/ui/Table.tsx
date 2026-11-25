import type React from "react";
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

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        zIndex.raised,
        "sticky top-0 h-th border-b border-line bg-surface-2 px-cell text-caption font-medium whitespace-nowrap text-fg-muted group-data-bleed/table:first:pl-page group-data-bleed/table:last:pr-page",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "h-row border-b border-line px-cell group-last/row:border-b-0 group-data-bleed/table:first:pl-page group-data-bleed/table:last:pr-page group-data-bleed/table:group-last/row:border-b",
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
