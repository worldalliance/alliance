import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../cn";
import { popupClass } from "../styles";
import { zIndex } from "../zIndex";

const GAP = 12;

export enum TipSide {
  /** Centred over the point, or under it where it would leave the frame's top. */
  Above = "above",
  /** Right of the point, or left of it where it would leave the frame's right. */
  Beside = "beside",
}

type Box = { width: number; height: number };

/** Where a tip of `tip`'s size goes so it stays inside `frame`. */
export function tipPosition({
  x,
  y,
  side,
  tip,
  frame,
}: {
  x: number;
  y: number;
  side: TipSide;
  tip: Box;
  frame: Box;
}): { left: number; top: number } {
  const within = (value: number, room: number) =>
    Math.max(0, Math.min(value, room));
  switch (side) {
    case TipSide.Above: {
      const above = y - tip.height - GAP;
      return {
        left: within(x - tip.width / 2, frame.width - tip.width),
        top: above >= 0 ? above : y + GAP,
      };
    }
    case TipSide.Beside: {
      const right = x + GAP;
      return {
        left:
          right + tip.width <= frame.width
            ? right
            : Math.max(0, x - GAP - tip.width),
        top: within(y, frame.height - tip.height),
      };
    }
    default:
      throw new Error(`unknown side: ${side satisfies never}`);
  }
}

/**
 * The detail of the mark under the pointer or the keyboard, as the `tip` of a
 * `ChartFrame`. `x` and `y` are the mark's place in the frame, in pixels; the
 * tip moves aside rather than leave the frame, so it never covers a control
 * outside the chart.
 */
export function ChartTip({
  title,
  x,
  y,
  side = TipSide.Above,
  children,
}: {
  title: ReactNode;
  x: number;
  y: number;
  side?: TipSide;
  /** `TipRow`s. */
  children: ReactNode;
}) {
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const frame = tip?.offsetParent;
    if (!tip || !frame) return;
    const next = tipPosition({
      x,
      y,
      side,
      tip: { width: tip.offsetWidth, height: tip.offsetHeight },
      frame: { width: frame.clientWidth, height: frame.clientHeight },
    });
    setPosition((current) =>
      current.left === next.left && current.top === next.top ? current : next,
    );
  }, [x, y, side, children]);

  return (
    <div
      ref={tipRef}
      className={cn(
        popupClass,
        zIndex.raised,
        "pointer-events-none absolute w-64 p-3 text-caption",
      )}
      style={position}
    >
      <p className="mb-1.5 font-semibold text-fg">{title}</p>
      <dl className="flex flex-col gap-1">{children}</dl>
    </div>
  );
}

export function TipRow({
  label,
  swatch,
  children,
}: {
  label: string;
  /** The colour of the series this row reads, as a value. */
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="flex min-w-0 items-center gap-1.5 text-fg-muted">
        {swatch && (
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: swatch }}
          />
        )}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}
