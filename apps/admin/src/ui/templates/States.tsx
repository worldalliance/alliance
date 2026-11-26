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
  // A bar is a block, so `text-right` on the cell doesn't move it.
  const end = (col: number) =>
    columnClassNames[col]?.split(/\s+/).includes("text-right") ? "ml-auto" : "";
  return (
    <Table bleed={bleed} aria-hidden="true">
      <TableHeader>
        <TableRow>
          {cols.map((col) => (
            <TableHead key={col} className={columnClassNames[col]}>
              <Skeleton className={cn("h-3 w-full max-w-16", end(col))} />
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
                  className={cn(
                    "h-3.5 w-full",
                    WIDTHS[(row + col) % WIDTHS.length],
                    end(col),
                  )}
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

type RefreshPart = {
  /** What went stale, lower case: "groups". */
  things: string;
  query: RefreshableQuery;
};

/** What `ContentState` reads of a query: a `useQuery` result fits. */
type LoadQuery = RefreshableQuery & {
  isPending: boolean;
  isLoadingError: boolean;
};

type LoadPart = { things: string; query: LoadQuery };

const LIST = new Intl.ListFormat("en-US");

/**
 * Says that content on screen is stale because its refetch failed, and offers
 * the retry. Renders nothing otherwise, so it can always be mounted: as
 * `Page`'s `banner`, as the first child of a tab body that owns the query, or
 * `inline` in a panel. Content fed by several queries passes them as `parts`,
 * for one banner naming those that failed.
 */
export function RefreshFailedBanner({
  inline = false,
  ...props
}: (RefreshPart | { parts: readonly RefreshPart[] }) & { inline?: boolean }) {
  const parts = "parts" in props ? props.parts : [props];
  const failed = parts.filter((part) => part.query.isRefetchError);
  if (failed.length === 0) return null;
  const reasons = new Set(
    failed.map((part) =>
      adminRefusalMessage(part.query.error, LOAD_FAILED_FALLBACK),
    ),
  );
  return (
    <Banner
      tone={BannerTone.Danger}
      inline={inline}
      action={
        <Button
          size="small"
          variant={ButtonVariant.Ghost}
          busy={failed.some((part) => part.query.isFetching)}
          onClick={() => failed.forEach((part) => void part.query.refetch())}
        >
          Try again
        </Button>
      }
    >
      Couldn't refresh {LIST.format(failed.map((part) => part.things))}.{" "}
      {[...reasons].join(" ")} Showing what loaded before.
    </Banner>
  );
}

type ContentStateBase = {
  /** Shown while loading, shaped like the content. */
  skeleton: ReactNode;
  onRetry?: () => void;
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

/** The states told by hand: `loading` is the first load, never a refetch. */
type ContentStateByHand = ContentStateBase & {
  loading: boolean;
  /** A failed load's reason; `null` or `undefined` when it didn't fail. */
  error?: string | null;
  /** "Couldn't load suites". */
  errorTitle: string;
  /** The retry is running: the query's `isFetching`. */
  retrying?: boolean;
};

/**
 * The states derived from the queries behind the content: the skeleton while
 * any is on its first load, the failed state when one's first load failed
 * (retrying those), and above the content a banner when a refetch failed.
 */
type ContentStateFromQueries = ContentStateBase & {
  /** Overrides "Couldn't load {things}", which names every failed part. */
  errorTitle?: string;
  /** Pass `false` where the page mounts `RefreshFailedBanner` itself. */
  refreshBanner?: boolean;
} & ({ things: string; query: LoadQuery } | { parts: readonly LoadPart[] });

export type ContentStateProps = ContentStateByHand | ContentStateFromQueries;

function byHand(props: ContentStateByHand) {
  return { ...props, banner: null };
}

function fromQueries(props: ContentStateFromQueries) {
  const parts = "parts" in props ? props.parts : [props];
  const failed = parts.filter((part) => part.query.isLoadingError);
  const first = failed[0];
  return {
    loading: parts.some((part) => part.query.isPending),
    error: first
      ? adminRefusalMessage(first.query.error, LOAD_FAILED_FALLBACK)
      : null,
    errorTitle:
      props.errorTitle ??
      `Couldn't load ${LIST.format(failed.map((part) => part.things))}`,
    retrying: failed.some((part) => part.query.isFetching),
    onRetry:
      props.onRetry ??
      (() => failed.forEach((part) => void part.query.refetch())),
    banner:
      props.refreshBanner === false ? null : (
        <RefreshFailedBanner parts={parts} inline />
      ),
  };
}

/**
 * Picks among loading, failed, no results, nothing yet and the content, so the
 * four never look alike. Use it for any region that loads. Hand it the query
 * (`things` and `query`) or several (`parts`) and it tells loading from a
 * failed load from a failed refetch itself; `loading` and `error` by hand are
 * for content no query backs.
 */
export function ContentState(props: ContentStateProps) {
  const {
    skeleton,
    empty = false,
    filtered = false,
    onClearFilters,
    emptyTitle = "Nothing here yet",
    emptyDescription,
    emptyAction,
    children,
  } = props;
  const { loading, error, errorTitle, retrying, onRetry, banner } =
    "loading" in props ? byHand(props) : fromQueries(props);
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
  const body = (() => {
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
  })();
  return banner ? (
    <>
      {banner}
      {body}
    </>
  ) : (
    body
  );
}
