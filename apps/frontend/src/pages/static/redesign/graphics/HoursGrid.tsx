import { cn } from "@alliance/shared/styles/util";
import {
  HOURS_END_LABEL,
  HOURS_LEGEND_SPENT,
  HOURS_LEGEND_TOTAL,
  HOURS_START_LABEL,
} from "../content";
import { useInView } from "../hooks";

const COLUMNS = 24;
const ROWS = 7;
/** The one hour that holds the 15 minutes members give. */
const SPENT_ROW = 2;
const SPENT_COLUMN = 11;

function Swatch({ solid }: { solid: boolean }) {
  return (
    <span
      className={cn(
        "size-3.5 rounded-[3px]",
        solid ? "bg-white" : "bg-white/25",
      )}
      aria-hidden
    />
  );
}

/** 168 cells, one per hour of the week. Fills in column by column on scroll. */
export function HoursGrid() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const cells = Array.from({ length: ROWS * COLUMNS }, (_, i) => i);

  return (
    <div ref={ref} className="flex flex-col">
      <p className="mb-2 text-sm text-white/85">{HOURS_START_LABEL}</p>
      {/* Too many cells to crush into a phone width, so it scrolls instead. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          className="grid min-w-[560px] gap-[3px] sm:min-w-0 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
        {cells.map((i) => {
          const row = Math.floor(i / COLUMNS);
          const column = i % COLUMNS;
          const isStart = i === 0;
          const isEnd = i === cells.length - 1;
          const isSpent = row === SPENT_ROW && column === SPENT_COLUMN;

          return (
            <div
              key={i}
              className={cn(
                "relative aspect-square rounded-[4px] transition-opacity duration-500 sm:rounded-[7px]",
                isStart || isEnd
                  ? "border-[1.5px] border-white bg-transparent"
                  : "bg-white/[0.22]",
                inView ? "opacity-100" : "opacity-0",
              )}
              style={{ transitionDelay: `${column * 26 + row * 8}ms` }}
            >
              {isSpent && (
                <span
                  className="absolute inset-x-0 top-1/2 h-[24%] -translate-y-1/2 rounded-[2px] bg-white transition-transform duration-500 ease-out"
                  style={{
                    transitionDelay: `${COLUMNS * 26 + 260}ms`,
                    transform: `translateY(-50%) scaleX(${inView ? 1 : 0})`,
                  }}
                />
              )}
            </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-white/85">
        <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2">
            <Swatch solid={false} />
            {HOURS_LEGEND_TOTAL}
          </span>
          <span className="flex items-center gap-2">
            <Swatch solid />
            {HOURS_LEGEND_SPENT}
          </span>
        </span>
        <span>{HOURS_END_LABEL}</span>
      </div>
    </div>
  );
}
