import { scaleBand, scaleLinear } from "d3";
import { useEffect, useRef, useState } from "react";
import { formatCount } from "../../lib/formatNumber";
import { YGrid } from "../../ui/charts/axes";
import { axisTextClass, chartColor, SERIES } from "../../ui/charts/chartColor";
import { ChartFrame, useChartCursor } from "../../ui/charts/ChartFrame";
import { ChartTip, TipRow } from "../../ui/charts/ChartTip";
import { PanelNote } from "../../ui/templates/Overview";
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
    fill: SERIES[0],
  },
  [ReminderChannel.Text]: {
    label: "Text",
    title: "Text click rate (average by task)",
    emptyMessage: "No texted reminder data in this range.",
    fill: SERIES[1],
  },
};

const HEIGHT = 300;
const MARGIN = { top: 20, right: 24, bottom: 48, left: 64 };
const NAME_LENGTH = 16;
const MIN_SLOT = 28;
const LABEL_SLOT = 110;
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function geometryOf(bars: ReminderActionChannelBar[], frameWidth: number) {
  // Too many bars for the frame scroll sideways rather than thin to nothing.
  const width = Math.max(
    frameWidth,
    MARGIN.left + MARGIN.right + bars.length * MIN_SLOT,
  );
  const xScale = scaleBand<string>()
    .domain(bars.map((_, index) => String(index)))
    .range([MARGIN.left, width - MARGIN.right])
    .paddingInner(0.2)
    .paddingOuter(0.08);
  const yScale = scaleLinear()
    .domain([0, 1])
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  return {
    width,
    xScale,
    yScale,
    labelEvery: Math.max(1, Math.ceil(LABEL_SLOT / xScale.step())),
  };
}

/** One channel's average click rate for each task. */
export function ReminderClickRateBarChart({
  bars,
  channel,
}: {
  bars: ReminderActionChannelBar[];
  channel: ReminderChannel;
}) {
  const cursor = useChartCursor(bars.length);
  const [scrollLeft, setScrollLeft] = useState(0);
  const { label, title, emptyMessage, fill } = REMINDER_CHANNEL[channel];
  const hovered = cursor.index === null ? undefined : bars[cursor.index];
  const svgRef = useRef<SVGSVGElement>(null);
  const keyed = useRef(false);
  // A bar reached by the keys may sit outside the scrolled view.
  useEffect(() => {
    if (!keyed.current || cursor.index === null) return;
    keyed.current = false;
    svgRef.current
      ?.querySelectorAll("[data-bar]")
      [cursor.index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor.index]);

  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h4 className="font-semibold">{title}</h4>
      {bars.length === 0 ? (
        <PanelNote>{emptyMessage}</PanelNote>
      ) : (
        <ChartFrame
          tip={(frameWidth) => {
            if (!hovered || cursor.index === null) return null;
            const { xScale, yScale } = geometryOf(bars, frameWidth);
            return (
              <ChartTip
                title={hovered.actionName}
                x={
                  (xScale(String(cursor.index)) ?? 0) +
                  xScale.bandwidth() / 2 -
                  scrollLeft
                }
                y={yScale(Math.max(0, Math.min(1, hovered.averageRate)))}
              >
                <TipRow label="Channel" swatch={fill}>
                  {label}
                </TipRow>
                <TipRow label="Click rate">
                  {percent(hovered.averageRate)}
                </TipRow>
                <TipRow label="Reminder groups averaged">
                  {formatCount(hovered.reminderGroupCount)}
                </TipRow>
                <TipRow label="Clicked / sent">
                  {formatCount(hovered.clickedCount)}/
                  {formatCount(hovered.sentCount)}
                </TipRow>
                <TipRow label="Task ID">{hovered.actionId}</TipRow>
              </ChartTip>
            );
          }}
        >
          {(frameWidth) => {
            const { width, xScale, yScale, labelEvery } = geometryOf(
              bars,
              frameWidth,
            );
            const band = xScale.bandwidth();
            return (
              <div
                className="overflow-x-auto"
                onScroll={(event) =>
                  setScrollLeft(event.currentTarget.scrollLeft)
                }
              >
                <svg
                  width={width}
                  height={HEIGHT}
                  viewBox={`0 0 ${width} ${HEIGHT}`}
                  role="img"
                  aria-label={`${title}. Arrow keys read each task.`}
                  ref={svgRef}
                  {...cursor.markProps}
                  onKeyDown={(event) => {
                    keyed.current = true;
                    cursor.markProps.onKeyDown(event);
                  }}
                  onMouseLeave={() => cursor.setIndex(null)}
                >
                  <YGrid
                    ticks={yScale.ticks(5)}
                    yScale={yScale}
                    yAxisFormat={percent}
                    width={width}
                    margin={MARGIN}
                  />
                  {bars.map((bar, index) => {
                    const x = xScale(String(index)) ?? 0;
                    const y = yScale(Math.max(0, Math.min(1, bar.averageRate)));
                    return (
                      <g key={bar.actionId}>
                        <rect
                          data-bar=""
                          x={x}
                          y={y}
                          width={band}
                          height={Math.max(0, HEIGHT - MARGIN.bottom - y)}
                          fill={fill}
                          stroke={
                            cursor.index === index ? chartColor.cursor : "none"
                          }
                          strokeWidth={2}
                          rx={3}
                          onMouseEnter={() => {
                            keyed.current = false;
                            cursor.setIndex(index);
                          }}
                        />
                        {index % labelEvery === 0 && (
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
            );
          }}
        </ChartFrame>
      )}
    </section>
  );
}
