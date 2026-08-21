import { cn } from "@alliance/shared/styles/util";
import {
  Children,
  isValidElement,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "../lib/useMediaQuery";

type ColumnBreakpoints = {
  default: number;
  sm?: number;
  md?: number;
  lg?: number;
};

type BalancedColumnsProps = {
  children: ReactNode;
  /** Fixed column count, or responsive breakpoints matching Tailwind `sm`/`md`/`lg`. */
  columns: number | ColumnBreakpoints;
  /** Gap between items and columns in px. Defaults to 8 (`gap-2`). */
  gap?: number;
  className?: string;
};

function useColumnCount(columns: number | ColumnBreakpoints): number {
  const isSm = useMediaQuery("(min-width: 640px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");

  if (typeof columns === "number") {
    return Math.max(1, columns);
  }

  if (isLg && columns.lg != null) return Math.max(1, columns.lg);
  if (isMd && columns.md != null) return Math.max(1, columns.md);
  if (isSm && columns.sm != null) return Math.max(1, columns.sm);
  return Math.max(1, columns.default);
}

function assignToColumns(params: {
  itemCount: number;
  heights: number[];
  columnCount: number;
  gap: number;
}): number[][] {
  const { itemCount, heights, columnCount, gap } = params;
  const columns: number[][] = Array.from({ length: columnCount }, () => []);

  // Until we have real measurements, fill left-to-right round-robin.
  if (!heights.some((height) => height > 0)) {
    for (let i = 0; i < itemCount; i++) {
      columns[i % columnCount].push(i);
    }
    return columns;
  }

  const columnHeights = Array.from({ length: columnCount }, () => 0);

  for (let i = 0; i < itemCount; i++) {
    let shortest = 0;
    for (let column = 1; column < columnCount; column++) {
      if (columnHeights[column] < columnHeights[shortest]) {
        shortest = column;
      }
    }

    const wasEmpty = columns[shortest].length === 0;
    columns[shortest].push(i);
    columnHeights[shortest] += (heights[i] ?? 0) + (wasEmpty ? 0 : gap);
  }

  return columns;
}

/**
 * Multi-column layout that packs items left-to-right into the shortest column,
 * keeping column heights as even as possible as content size changes.
 */
export default function BalancedColumns({
  children,
  columns: columnsProp,
  gap = 8,
  className,
}: BalancedColumnsProps) {
  const columnCount = useColumnCount(columnsProp);
  const items = Children.toArray(children);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: items.length }, () => 0),
  );

  const columnAssignments = assignToColumns({
    itemCount: items.length,
    heights,
    columnCount,
    gap,
  });
  const assignmentKey = columnAssignments
    .map((indexes) => indexes.join(","))
    .join("|");

  useLayoutEffect(() => {
    const measure = () => {
      const next = Array.from({ length: items.length }, (_, index) => {
        return itemRefs.current[index]?.offsetHeight ?? 0;
      });
      setHeights((prev) => {
        if (
          prev.length === next.length &&
          prev.every((height, index) => height === next[index])
        ) {
          return prev;
        }
        return next;
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observers = Array.from({ length: items.length }, (_, index) => {
      const element = itemRefs.current[index];
      if (!element) return null;
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return observer;
    });

    return () => {
      for (const observer of observers) {
        observer?.disconnect();
      }
    };
  }, [items.length, columnCount, gap, assignmentKey]);

  return (
    <div className={cn("flex w-full items-start", className)} style={{ gap }}>
      {columnAssignments.map((itemIndexes, columnIndex) => (
        <div
          key={columnIndex}
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap }}
        >
          {itemIndexes.map((itemIndex) => {
            const item = items[itemIndex];
            const key =
              isValidElement(item) && item.key != null ? item.key : itemIndex;

            return (
              <div
                key={key}
                ref={(element) => {
                  itemRefs.current[itemIndex] = element;
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
