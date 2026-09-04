import { cn } from "@alliance/shared/styles/util";
import {
  HOURS_END_LABEL,
  HOURS_LEGEND_SPENT,
  HOURS_LEGEND_TOTAL,
  HOURS_START_LABEL,
} from "../content";
import { useInView } from "../hooks";

const HOURS = 168;

/**
 * A day per row reads best where there is width for 24 columns. A phone gets a
 * squarer arrangement of the same 168 hours instead, so each cell is big enough
 * to see.
 */
const WIDE_COLUMNS = 24;
const NARROW_COLUMNS = 12;

/** Fraction of the way through the week that the 15 minutes are spent. */
const SPENT_AT = 0.464;

export enum HoursGridSize {
  Default = "default",
  /** For the onboarding panel, which has a fixed height and never scrolls. */
  Compact = "compact",
}

const gridClasses: Record<HoursGridSize, string> = {
  [HoursGridSize.Default]: "min-w-[560px] gap-[3px] sm:min-w-0 sm:gap-1.5",
  [HoursGridSize.Compact]: "gap-[clamp(2px,0.6vh,7px)]",
};

const wrapClasses: Record<HoursGridSize, string> = {
  [HoursGridSize.Default]: "-mx-1 overflow-x-auto px-1 pb-1",
  [HoursGridSize.Compact]: "",
};

const labelClasses: Record<HoursGridSize, string> = {
  [HoursGridSize.Default]: "text-sm",
  [HoursGridSize.Compact]: "text-[length:var(--ob-caption)]",
};

const cellClasses: Record<HoursGridSize, string> = {
  [HoursGridSize.Default]: "rounded-[4px] sm:rounded-[7px]",
  [HoursGridSize.Compact]: "rounded-[clamp(3px,0.8vh,8px)]",
};

const legendClasses: Record<HoursGridSize, string> = {
  [HoursGridSize.Default]: "gap-x-6 gap-y-2",
  [HoursGridSize.Compact]: "gap-x-3 gap-y-1",
};

const swatchClasses: Record<HoursGridSize, string> = {
  [HoursGridSize.Default]: "size-3.5 rounded-[3px]",
  [HoursGridSize.Compact]:
    "size-[clamp(0.5rem,1.2vh,0.875rem)] rounded-[3px] shrink-0",
};

function Swatch({ solid, size }: { solid: boolean; size: HoursGridSize }) {
  return (
    <span
      className={cn(swatchClasses[size], solid ? "bg-white" : "bg-white/25")}
      aria-hidden
    />
  );
}

function Grid({
  columns,
  size,
  inView,
  className,
  fill = false,
}: {
  columns: number;
  size: HoursGridSize;
  inView: boolean;
  className?: string;
  /** Stretches the cells to whatever box is left rather than squaring them. */
  fill?: boolean;
}) {
  const spent = Math.round(HOURS * SPENT_AT);

  return (
    <div
      className={cn(
        "mx-auto grid",
        fill && "h-full",
        gridClasses[size],
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: fill
          ? `repeat(${HOURS / columns}, minmax(0, 1fr))`
          : undefined,
      }}
    >
      {Array.from({ length: HOURS }, (_, i) => {
        const row = Math.floor(i / columns);
        const column = i % columns;

        return (
          <div
            key={i}
            className={cn(
              "relative transition-opacity duration-500",
              fill ? "min-h-0" : "aspect-square",
              cellClasses[size],
              i === 0 || i === HOURS - 1
                ? "border-[1.5px] border-white bg-transparent"
                : "bg-white/[0.22]",
              inView ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: `${column * 26 + row * 8}ms` }}
          >
            {i === spent && (
              <span
                className="absolute inset-x-0 top-1/2 h-[24%] -translate-y-1/2 rounded-[2px] bg-white transition-transform duration-500 ease-out"
                style={{
                  transitionDelay: `${columns * 26 + 260}ms`,
                  transform: `translateY(-50%) scaleX(${inView ? 1 : 0})`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 168 cells, one per hour of the week. Fills in column by column on scroll. */
export function HoursGrid({
  size = HoursGridSize.Default,
  className,
}: {
  size?: HoursGridSize;
  className?: string;
} = {}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const compact = size === HoursGridSize.Compact;

  return (
    <div
      ref={ref}
      className={cn("flex flex-col", compact && "min-h-0 flex-1", className)}
    >
      <p className={cn("mb-2 text-white/85", labelClasses[size])}>
        {HOURS_START_LABEL}
      </p>
      <div className={cn(wrapClasses[size], compact && "min-h-0 flex-1")}>
        {compact && (
          <Grid
            columns={NARROW_COLUMNS}
            size={size}
            inView={inView}
            className="sm:hidden"
            fill
          />
        )}
        <Grid
          columns={WIDE_COLUMNS}
          size={size}
          inView={inView}
          className={compact ? "hidden sm:grid" : undefined}
        />
      </div>
      <div
        className={cn(
          "mt-3 flex flex-wrap items-center justify-between text-white/85",
          legendClasses[size],
          labelClasses[size],
        )}
      >
        <span
          className={cn("flex flex-wrap items-center", legendClasses[size])}
        >
          <span className="flex items-center gap-2">
            <Swatch solid size={size} />
            {HOURS_LEGEND_SPENT}
          </span>
          <span className="flex items-center gap-2">
            <Swatch solid={false} size={size} />
            {HOURS_LEGEND_TOTAL}
          </span>
        </span>
        <span>{HOURS_END_LABEL}</span>
      </div>
    </div>
  );
}
