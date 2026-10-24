// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import { analyticsGetTimeToChurnSamplesAdmin } from "@alliance/shared/client";
import { TimeToChurnSampleDto } from "@alliance/shared/client/types.gen";
import { bin, max, range, scaleLinear } from "d3";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const TimeToChurnCard: React.FC = () => {
  const [timeToChurnSamples, setTimeToChurnSamples] = useState<
    TimeToChurnSampleDto[]
  >([]);
  const [timeToChurnLoading, setTimeToChurnLoading] = useState<boolean>(false);

  const loadTimeToChurnSamples = useCallback(async () => {
    setTimeToChurnLoading(true);
    try {
      const response = await analyticsGetTimeToChurnSamplesAdmin();
      setTimeToChurnSamples(response.data ?? []);
    } catch (err) {
      console.error("Failed to load time to churn samples", err);
    } finally {
      setTimeToChurnLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTimeToChurnSamples();
  }, [loadTimeToChurnSamples]);

  const churnDurationsWeeks = useMemo(() => {
    return timeToChurnSamples
      .map((sample) => sample.daysToChurn / 7)
      .filter((value) => Number.isFinite(value) && value >= 0);
  }, [timeToChurnSamples]);

  const churnHistogramGeometry = useMemo(() => {
    if (churnDurationsWeeks.length === 0) return null;

    const width = 1000;
    const height = 320;
    const margin = { top: 28, right: 24, bottom: 56, left: 64 };
    const maxWeeks = max(churnDurationsWeeks) ?? 0;
    const xMax = Math.max(1, maxWeeks);

    const xScale = scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([margin.left, width - margin.right]);

    const maxWeekLabel = Math.max(1, Math.ceil(xMax));
    const weeklyThresholds = range(0, maxWeekLabel + 1, 1);

    const bins = bin<number, number>()
      .domain(xScale.domain() as [number, number])
      .thresholds(weeklyThresholds)(churnDurationsWeeks);

    const trimmedBins = [...bins];
    while (
      trimmedBins.length > 1 &&
      trimmedBins[trimmedBins.length - 1].length === 0
    ) {
      trimmedBins.pop();
    }

    const maxCount = max(trimmedBins, (bin) => bin.length) ?? 0;
    const yScale = scaleLinear()
      .domain([0, Math.max(1, maxCount)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const xTicks = trimmedBins.map((bin) => {
      const x0 = bin.x0 ?? 0;
      const x1 = bin.x1 ?? x0 + 1;
      return {
        value: (x0 + x1) / 2,
        label: Math.round(x0),
      };
    });
    const yTicks = yScale.ticks(5);

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      xTicks,
      yTicks,
      bins: trimmedBins,
    };
  }, [churnDurationsWeeks]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 border-b border-gray-200">
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900">Time to churn</h3>
          <span className="text-xs text-gray-500">
            From signing to last completed action
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {timeToChurnSamples.length > 0
            ? `${timeToChurnSamples.length} churned members`
            : "No churned members yet"}
        </div>
      </div>
      <div className="relative p-4 pb-2">
        {timeToChurnLoading && churnDurationsWeeks.length === 0 && (
          <p className="text-sm text-gray-600">Loading time to churn...</p>
        )}
        {!timeToChurnLoading && churnDurationsWeeks.length === 0 && (
          <p className="text-sm text-gray-600">No churned members yet.</p>
        )}
        {churnHistogramGeometry && churnDurationsWeeks.length > 0 && (
          <svg
            viewBox={`0 0 ${churnHistogramGeometry.width} ${churnHistogramGeometry.height}`}
            className="w-full"
          >
            <g>
              {churnHistogramGeometry.yTicks.map((tick) => (
                <g key={`churn-y-${tick}`}>
                  <line
                    x1={churnHistogramGeometry.margin.left}
                    x2={
                      churnHistogramGeometry.width -
                      churnHistogramGeometry.margin.right
                    }
                    y1={churnHistogramGeometry.yScale(tick)}
                    y2={churnHistogramGeometry.yScale(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={churnHistogramGeometry.margin.left - 10}
                    y={churnHistogramGeometry.yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-500 text-xs"
                  >
                    {tick}
                  </text>
                </g>
              ))}
              {churnHistogramGeometry.xTicks.map((tick) => (
                <g key={`churn-x-${tick.label}`}>
                  <line
                    x1={churnHistogramGeometry.xScale(tick.value)}
                    x2={churnHistogramGeometry.xScale(tick.value)}
                    y1={churnHistogramGeometry.margin.top}
                    y2={
                      churnHistogramGeometry.height -
                      churnHistogramGeometry.margin.bottom
                    }
                    stroke="#f3f4f6"
                  />
                  <text
                    x={churnHistogramGeometry.xScale(tick.value)}
                    y={
                      churnHistogramGeometry.height -
                      churnHistogramGeometry.margin.bottom +
                      24
                    }
                    textAnchor="middle"
                    className="fill-gray-600 text-xs"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
            </g>

            {churnHistogramGeometry.bins.map((bin, index) => {
              const x0 = bin.x0 ?? 0;
              const x1 = bin.x1 ?? x0;
              const barWidth = Math.max(
                0,
                churnHistogramGeometry.xScale(x1) -
                  churnHistogramGeometry.xScale(x0) -
                  2,
              );
              const barHeight =
                churnHistogramGeometry.yScale(0) -
                churnHistogramGeometry.yScale(bin.length);
              const x = churnHistogramGeometry.xScale(x0) + 1;
              const y = churnHistogramGeometry.yScale(bin.length);
              const labelStart = Math.round(x0);
              const labelEnd = Math.round(x1);

              return (
                <g key={`churn-bin-${index}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="rgba(239, 68, 68, 0.75)"
                    rx={4}
                  >
                    <title>{`${labelStart}-${labelEnd}w: ${bin.length} members`}</title>
                  </rect>
                </g>
              );
            })}

            <text
              x={
                (churnHistogramGeometry.width -
                  churnHistogramGeometry.margin.left -
                  churnHistogramGeometry.margin.right) /
                  2 +
                churnHistogramGeometry.margin.left
              }
              y={churnHistogramGeometry.height - 12}
              textAnchor="middle"
              className="fill-gray-500 text-xs"
            >
              Weeks since signing
            </text>
          </svg>
        )}
      </div>
    </div>
  );
};

export default TimeToChurnCard;
