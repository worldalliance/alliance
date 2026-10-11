import type { ScaleLinear } from "d3";
import React from "react";

export const CHART_WIDTH = 1000;
export const CHART_MARGIN = { top: 28, right: 32, bottom: 64, left: 72 };

export function dedupeTickLabels(
  ticks: number[],
  format?: (value: number) => string,
): number[] {
  const seen = new Set<string>();
  return ticks.filter((tick) => {
    const label = format ? format(tick) : String(tick);
    if (!label) return true;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export const YGrid: React.FC<{
  ticks: number[];
  yScale: ScaleLinear<number, number>;
  yAxisFormat?: (value: number) => string;
  width: number;
  margin: typeof CHART_MARGIN;
}> = ({ ticks, yScale, yAxisFormat, width, margin }) =>
  ticks.map((tick) => (
    <g key={`y-${tick}`}>
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={yScale(tick)}
        y2={yScale(tick)}
        stroke="#e5e7eb"
        strokeDasharray="4 6"
      />
      <text
        x={margin.left - 12}
        y={yScale(tick)}
        textAnchor="end"
        dominantBaseline="middle"
        className="fill-gray-500 text-xs"
      >
        {yAxisFormat ? yAxisFormat(tick) : tick}
      </text>
    </g>
  ));
