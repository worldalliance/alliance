import { scaleBand, scaleLinear } from "d3";
import { useMemo } from "react";
import { axisTextClass, chartColor, PanelNote } from "./chartParts";
import {
  ReminderChannel,
  type ReminderActionChannelBar,
} from "./reminderClickRateData";

export const REMINDER_CHANNEL: Record<
  ReminderChannel,
  { label: string; title: string; emptyMessage: string; fill: string }
> = {
  [ReminderChannel.Email]: {
    label: "Email",
    title: "Email click rate (average by task)",
    emptyMessage: "No emailed reminder data in this range.",
    fill: chartColor.email,
  },
  [ReminderChannel.Text]: {
    label: "Text",
    title: "Text click rate (average by task)",
    emptyMessage: "No texted reminder data in this range.",
    fill: chartColor.text,
  },
};

const HEIGHT = 360;
const MARGIN = { top: 20, right: 24, bottom: 48, left: 64 };
const NAME_LENGTH = 16;
const MIN_WIDTH = 900;
const BAR_SLOT = 64;

function geometryOf(bars: ReminderActionChannelBar[]) {
  const width = Math.max(MIN_WIDTH, bars.length * BAR_SLOT + 120);
  const xScale = scaleBand<string>()
    .domain(bars.map((_, index) => String(index)))
    .range([MARGIN.left, width - MARGIN.right])
    .paddingInner(0.2)
    .paddingOuter(0.08);
  const yScale = scaleLinear()
    .domain([0, 1])
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  // Every other bar is named when the names would touch.
  const step = bars.length * 110 > width ? 2 : 1;
  const labelled = bars
    .map((_, index) => index)
    .filter((index) => index % step === 0);
  return { width, xScale, yScale, labelled };
}

/** One channel's average click rate for each task. */
export function ReminderClickRateBarChart({
  bars,
  channel,
  onHoverBar,
}: {
  bars: ReminderActionChannelBar[];
  channel: ReminderChannel;
  onHoverBar: (bar: ReminderActionChannelBar | null) => void;
}) {
  const geometry = useMemo(() => geometryOf(bars), [bars]);
  const { title, emptyMessage, fill } = REMINDER_CHANNEL[channel];

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h4 className="font-semibold">{title}</h4>
      {bars.length === 0 ? (
        <PanelNote>{emptyMessage}</PanelNote>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${geometry.width} ${HEIGHT}`}
            className="w-full"
            // Drawn at its own size, so labels stay legible; the box scrolls.
            style={{ minWidth: geometry.width }}
            role="img"
            aria-label={title}
            onMouseLeave={() => onHoverBar(null)}
          >
            {geometry.yScale.ticks(5).map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={geometry.width - MARGIN.right}
                  y1={geometry.yScale(tick)}
                  y2={geometry.yScale(tick)}
                  stroke={chartColor.grid}
                  strokeDasharray="4 6"
                />
                <text
                  x={MARGIN.left - 12}
                  y={geometry.yScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className={axisTextClass}
                >
                  {Math.round(tick * 100)}%
                </text>
              </g>
            ))}
            {bars.map((bar, index) => {
              const x = geometry.xScale(String(index)) ?? 0;
              const y = geometry.yScale(
                Math.max(0, Math.min(1, bar.averageRate)),
              );
              const band = geometry.xScale.bandwidth();
              return (
                <g key={bar.actionId}>
                  <rect
                    data-bar=""
                    x={x}
                    y={y}
                    width={band}
                    height={Math.max(0, HEIGHT - MARGIN.bottom - y)}
                    fill={fill}
                    rx={3}
                    onMouseEnter={() => onHoverBar(bar)}
                  />
                  {geometry.labelled.includes(index) && (
                    <text
                      x={x + band / 2}
                      y={HEIGHT - MARGIN.bottom + 24}
                      textAnchor="middle"
                      className={axisTextClass}
                    >
                      {bar.actionName.length > NAME_LENGTH
                        ? `${bar.actionName.slice(0, NAME_LENGTH)}...`
                        : bar.actionName}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
