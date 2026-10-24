import { scaleBand, scaleLinear } from "d3";
import React, { useMemo } from "react";
import {
  ReminderChannel,
  type ReminderActionChannelBar,
} from "./reminderClickRateData";

export const reminderChannelStyles: Record<
  ReminderChannel,
  { title: string; emptyMessage: string; fill: string; rateClassName: string }
> = {
  [ReminderChannel.Email]: {
    title: "Email Click Rate (Avg by Action)",
    emptyMessage: "No emailed reminder data in this range.",
    fill: "#2563eb",
    rateClassName: "text-blue-600",
  },
  [ReminderChannel.Text]: {
    title: "Text Click Rate (Avg by Action)",
    emptyMessage: "No texted reminder data in this range.",
    fill: "#ea580c",
    rateClassName: "text-orange-600",
  },
};

const buildReminderActionBarGeometry = (bars: ReminderActionChannelBar[]) => {
  if (bars.length === 0) return null;

  const width = Math.max(900, bars.length * 88 + 120);
  const height = 420;
  const margin = { top: 20, right: 24, bottom: 86, left: 64 };

  const xScale = scaleBand<string>()
    .domain(bars.map((_, index) => String(index)))
    .range([margin.left, width - margin.right])
    .paddingInner(0.2)
    .paddingOuter(0.08);

  const yScale = scaleLinear()
    .domain([0, 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const yTicks = yScale.ticks(5);
  const maxXTicks = 10;
  const xTickStep = Math.max(1, Math.ceil(bars.length / maxXTicks));
  const xTickIndexes = bars
    .map((_, index) => index)
    .filter((index) => index % xTickStep === 0 || index === bars.length - 1);

  return {
    width,
    height,
    margin,
    xScale,
    yScale,
    yTicks,
    xTickIndexes,
  };
};

const ReminderClickRateBarChart: React.FC<{
  bars: ReminderActionChannelBar[];
  channel: ReminderChannel;
  onHoverBar: (bar: ReminderActionChannelBar | null) => void;
}> = ({ bars, channel, onHoverBar }) => {
  const geometry = useMemo(() => buildReminderActionBarGeometry(bars), [bars]);
  const { title, emptyMessage, fill } = reminderChannelStyles[channel];

  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="px-3 py-2 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="p-3">
        {!geometry ? (
          <p className="text-sm text-gray-600">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              className="w-full min-w-[900px]"
              onMouseLeave={() => onHoverBar(null)}
            >
              <g>
                {geometry.yTicks.map((tick) => (
                  <g key={`${channel}-action-y-${tick}`}>
                    <line
                      x1={geometry.margin.left}
                      x2={geometry.width - geometry.margin.right}
                      y1={geometry.yScale(tick)}
                      y2={geometry.yScale(tick)}
                      stroke="#e5e7eb"
                      strokeDasharray="4 6"
                    />
                    <text
                      x={geometry.margin.left - 12}
                      y={geometry.yScale(tick)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-gray-500 text-base"
                    >
                      {Math.round(tick * 100)}%
                    </text>
                  </g>
                ))}
                {geometry.xTickIndexes.map((index) => {
                  const x = geometry.xScale(String(index));
                  if (x === undefined) return null;
                  const action = bars[index];
                  const label =
                    action.actionName.length > 16
                      ? `${action.actionName.slice(0, 16)}...`
                      : action.actionName;
                  return (
                    <text
                      key={`${channel}-action-x-${action.actionId}`}
                      x={x + geometry.xScale.bandwidth() / 2}
                      y={geometry.height - geometry.margin.bottom + 24}
                      textAnchor="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {label}
                    </text>
                  );
                })}
              </g>

              {bars.map((bar, index) => {
                const x = geometry.xScale(String(index));
                if (x === undefined) return null;
                const y = geometry.yScale(
                  Math.max(0, Math.min(1, bar.averageRate)),
                );
                const barBottom = geometry.height - geometry.margin.bottom;
                return (
                  <rect
                    key={`${channel}-action-bar-${bar.actionId}`}
                    x={x}
                    y={y}
                    width={geometry.xScale.bandwidth()}
                    height={Math.max(0, barBottom - y)}
                    fill={fill}
                    rx={3}
                    className="cursor-pointer"
                    onMouseEnter={() => onHoverBar(bar)}
                  />
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReminderClickRateBarChart;
