import type { ReactNode } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import Button, { ButtonVariant } from "../Button";
import { cn } from "../cn";
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
import { Banner, BannerTone } from "./Banner";
import { useDelayedFlag } from "./useDelayedFlag";

/** The reason to show for a failed load when the server gave none. */
export const LOAD_FAILED_FALLBACK = "The server didn't answer. Try again.";

/** A load that failed, in the place the content would be. Stays until it is retried. */
export function ErrorState({
  title,
  reason,
  onRetry,
  retrying = false,
}: {
  /** What couldn't load: "Couldn't load suites". */
  title: string;
  /** The server's reason. */
  reason?: string;
  onRetry?: () => void;
  /** The retry is running: the query's `isFetching`. */
  retrying?: boolean;
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
          busy={retrying}
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
  columnClassNames = [],
}: {
  columns: number;
  rows?: number;
  bleed?: boolean;
  /**
   * The classes the real table gives each column's cells, by position, where
   * it sets a width or an alignment, so the columns don't jump when rows land.
   */
  columnClassNames?: readonly (string | undefined)[];
}) {
  const cols = Array.from({ length: columns }, (_, i) => i);
  return (
    <Table bleed={bleed} aria-hidden="true">
      <TableHeader>
        <TableRow>
          {cols.map((col) => (
            <TableHead key={col} className={columnClassNames[col]}>
              <Skeleton className="h-3 w-full max-w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={row}>
            {cols.map((col) => (
              <TableCell key={col} className={columnClassNames[col]}>
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

/** A form's fields in outline: a label and a control each. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card"
    >
      {Array.from({ length: fields }, (_, field) => (
        <div key={field} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-control w-full" />
        </div>
      ))}
    </div>
  );
}

// Laid out from the start and hidden until the delay passes: the region has
// its loading height at once, so what sits under it never moves.
function DelayedSkeleton({ children }: { children: ReactNode }) {
  const show = useDelayedFlag(true);
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(!show && "invisible")}
    >
      {children}
    </div>
  );
}

/** What `RefreshFailedBanner` reads of a query. */
type RefreshableQuery = {
  isRefetchError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * Says that content on screen is stale because its refetch failed, and offers
 * the retry. Renders nothing otherwise, so it can always be mounted: as
 * `Page`'s `banner`, as the first child of a tab body that owns the query, or
 * `inline` in a panel.
 */
export function RefreshFailedBanner({
  things,
  query,
  inline = false,
}: {
  /** What went stale, lower case: "groups". */
  things: string;
  query: RefreshableQuery;
  inline?: boolean;
}) {
  if (!query.isRefetchError) return null;
  return (
    <Banner
      tone={BannerTone.Danger}
      inline={inline}
      action={
        <Button
          size="small"
          variant={ButtonVariant.Ghost}
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      }
    >
      Couldn't refresh {things}.{" "}
      {adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)} Showing what
      loaded before.
    </Banner>
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
  /** The retry is running: the query's `isFetching`. */
  retrying?: boolean;
  /** The loaded content has no items. Omit, with `emptyTitle`, for content that is never empty. */
  empty?: boolean;
  /** Search or filters are applied, so empty means no results. */
  filtered?: boolean;
  onClearFilters?: () => void;
  /** Nothing yet: names what is empty and offers the next step. */
  emptyTitle?: string;
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
  retrying,
  empty = false,
  filtered = false,
  onClearFilters,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  children,
}: ContentStateProps) {
  if (error !== null && error !== undefined) {
    return (
      <ErrorState
        title={errorTitle}
        reason={error}
        onRetry={onRetry}
        retrying={retrying}
      />
    );
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
