import {
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../cn";

/** The width a chart is drawn at where its box can't be measured, as in a test. */
export const FALLBACK_CHART_WIDTH = 1000;

/**
 * The box a chart is drawn in. It hands the chart its width in pixels, so the
 * chart draws at its real size and its text stays the size it was set at, and
 * it is the box a `ChartTip` is placed in. `updating` keeps the chart on
 * screen, dimmed, while the data behind it is replaced.
 */
export function ChartFrame({
  updating = false,
  tip,
  className,
  children,
}: {
  updating?: boolean;
  /** The `ChartTip` for the mark under the pointer or the keyboard, given the drawn width. */
  tip?: ReactNode | ((width: number) => ReactNode);
  className?: string;
  children: (width: number) => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(FALLBACK_CHART_WIDTH);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      if (frame.clientWidth > 0) setWidth(frame.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      aria-busy={updating || undefined}
      className={cn("relative min-w-0", className)}
    >
      <div
        className={cn(
          "transition-opacity duration-base",
          updating && "opacity-40",
        )}
      >
        {children(width)}
      </div>
      {updating && (
        <p
          role="status"
          className="absolute top-0 right-0 rounded-sm bg-surface px-2 text-caption font-medium text-fg-muted"
        >
          Updating…
        </p>
      )}
      <div aria-live="polite">
        {typeof tip === "function" ? tip(width) : tip}
      </div>
    </div>
  );
}

/**
 * Which mark of a chart is active, for the pointer and the keyboard alike.
 * Spread `markProps` on the chart's `<svg>`: it takes focus, and the arrow
 * keys, Home and End move through the marks, so what a pointer reads by
 * hovering a keyboard reads too. Escape and leaving clear it.
 */
export function useChartCursor(
  count: number,
  { vertical = false }: { vertical?: boolean } = {},
) {
  const [index, setIndex] = useState<number | null>(null);
  const [previous, next] = vertical
    ? ["ArrowUp", "ArrowDown"]
    : ["ArrowLeft", "ArrowRight"];
  const onKeyDown = (event: KeyboardEvent) => {
    if (count === 0) return;
    const last = count - 1;
    const at = index === null ? null : Math.min(index, last);
    let to: number;
    if (event.key === next) to = at === null ? 0 : Math.min(last, at + 1);
    else if (event.key === previous) {
      to = at === null ? last : Math.max(0, at - 1);
    } else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = last;
    else {
      if (event.key === "Escape") setIndex(null);
      return;
    }
    event.preventDefault();
    setIndex(to);
  };
  return {
    index: index !== null && index < count ? index : null,
    setIndex,
    markProps: {
      tabIndex: 0,
      onKeyDown,
      onBlur: () => setIndex(null),
      className: "rounded-sm focus-ring",
    },
  };
}
