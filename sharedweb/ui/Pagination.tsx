import { cn } from "@alliance/shared/styles/util";
import { useMemo } from "react";

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Pages shown on each side of the current page. */
  siblingCount?: number;
  className?: string;
}

const ELLIPSIS = "ellipsis";
type PageItem = number | typeof ELLIPSIS;

const range = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

function getPageItems(
  page: number,
  totalPages: number,
  siblingCount: number,
): PageItem[] {
  // first + last + current + siblings + both ellipsis slots
  const maxSlots = 2 * siblingCount + 5;
  if (totalPages <= maxSlots) {
    return range(1, totalPages);
  }

  const showLeftEllipsis = page - siblingCount > 2;
  const showRightEllipsis = page + siblingCount < totalPages - 1;
  // Near an edge, widen the run so the item count stays constant
  const edgeRunLength = 2 * siblingCount + 3;

  if (!showLeftEllipsis) {
    return [...range(1, edgeRunLength), ELLIPSIS, totalPages];
  }
  if (!showRightEllipsis) {
    return [1, ELLIPSIS, ...range(totalPages - edgeRunLength + 1, totalPages)];
  }
  return [
    1,
    ELLIPSIS,
    ...range(page - siblingCount, page + siblingCount),
    ELLIPSIS,
    totalPages,
  ];
}

const buttonClass =
  "text-sm border border-gray-2 text-black bg-white hover:bg-zinc-50 rounded-sm px-3 py-2 disabled:opacity-40 disabled:hover:bg-white";

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}) => {
  const items = useMemo(
    () => getPageItems(page, totalPages, siblingCount),
    [page, totalPages, siblingCount],
  );

  if (totalPages <= 1) return null;

  const goTo = (target: number) => {
    if (target !== page && target >= 1 && target <= totalPages) {
      onPageChange(target);
    }
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-row items-center gap-1", className)}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className={buttonClass}
      >
        Previous
      </button>
      {items.map((item, index) =>
        item === ELLIPSIS ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="px-1.5 text-sm text-zinc-400 select-none"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? "page" : undefined}
            onClick={() => goTo(item)}
            className={cn(
              buttonClass,
              item === page &&
                "bg-zinc-800 border-zinc-800 text-white hover:bg-zinc-800",
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className={buttonClass}
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;
