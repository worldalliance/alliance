import type { ReactNode } from "react";
import Button, { ButtonVariant } from "../Button";
import { EmptyState } from "../EmptyState";
import { Skeleton } from "../Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";
import { useDelayedFlag } from "./useDelayedFlag";

/** The reason to show for a failed load when the server gave none. */
export const LOAD_FAILED_FALLBACK = "Check your connection and try again.";

/** A load that failed, in the place the content would be. Stays until it is retried. */
export function ErrorState({
  title,
  reason,
  onRetry,
}: {
  /** What couldn't load: "Couldn't load suites". */
  title: string;
  /** The server's reason. */
  reason?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-1 px-card py-10 text-center"
    >
      <p className="font-medium text-danger">{title}</p>
      {reason && <p className="max-w-md text-fg-muted">{reason}</p>}
      {onRetry && (
        <Button
          variant={ButtonVariant.Default}
          onClick={onRetry}
          className="mt-3"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

// Caps, not widths: the bars share the table's width, so a skeleton of many
// columns is never wider than the table it stands in for.
const WIDTHS = [
  "max-w-40",
  "max-w-24",
  "max-w-28",
  "max-w-20",
  "max-w-32",
  "max-w-16",
] as const;

/** Rows in the shape of a `Table`, with its row and header heights. */
export function TableSkeleton({
  columns,
  rows = 8,
  bleed = false,
}: {
  columns: number;
  rows?: number;
  bleed?: boolean;
}) {
  const cols = Array.from({ length: columns }, (_, i) => i);
  return (
    <Table bleed={bleed} aria-hidden="true">
      <TableHeader>
        <TableRow>
          {cols.map((col) => (
            <TableHead key={col}>
              <Skeleton className="h-3 w-full max-w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={row}>
            {cols.map((col) => (
              <TableCell key={col}>
                <Skeleton
                  className={`h-3.5 w-full ${WIDTHS[(row + col) % WIDTHS.length]}`}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DelayedSkeleton({ children }: { children: ReactNode }) {
  const show = useDelayedFlag(true);
  return (
    <div role="status" aria-label="Loading">
      {show && children}
    </div>
  );
}

export type ContentStateProps = {
  /** The first load, with nothing to show yet. Not a refetch. */
  loading: boolean;
  /** Shown while loading, shaped like the content. */
  skeleton: ReactNode;
  /** A failed load's reason; `null` or `undefined` when it didn't fail. */
  error?: string | null;
  /** "Couldn't load suites". */
  errorTitle: string;
  onRetry?: () => void;
  /** The loaded content has no items. */
  empty: boolean;
  /** Search or filters are applied, so empty means no results. */
  filtered?: boolean;
  onClearFilters?: () => void;
  /** Nothing yet: names what is empty and offers the next step. */
  emptyTitle: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  children: ReactNode;
};

/**
 * Picks among loading, failed, no results, nothing yet and the content, so the
 * four never look alike. Use it for any region that loads.
 */
export function ContentState({
  loading,
  skeleton,
  error,
  errorTitle,
  onRetry,
  empty,
  filtered = false,
  onClearFilters,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: ContentStateProps) {
  if (error !== null && error !== undefined) {
    return <ErrorState title={errorTitle} reason={error} onRetry={onRetry} />;
  }
  if (loading) return <DelayedSkeleton>{skeleton}</DelayedSkeleton>;
  if (empty && filtered) {
    return (
      <EmptyState
        title="No results"
        description="Nothing matches the search and filters."
        action={
          onClearFilters && (
            <Button variant={ButtonVariant.Default} onClick={onClearFilters}>
              Clear filters
            </Button>
          )
        }
      />
    );
  }
  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return children;
}
