import { bin, max, range, scaleLinear } from "d3";
import React, { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useTimeToChurnSamplesAdmin } from "../../lib/useTimeToChurnSamplesAdmin";
import ChartData from "../ui/ChartData";
import Section from "../ui/Section";

const weekRange = ({ x0 = 0, x1 }: { x0?: number; x1?: number }) =>
  `${Math.round(x0)}–${Math.round(x1 ?? x0)}`;

const TimeToChurnCard: React.FC = () => {
  const {
    data,
    isPending: timeToChurnLoading,
    error: timeToChurnError,
  } = useTimeToChurnSamplesAdmin();
  const timeToChurnSamples = useMemo(
    () => (timeToChurnError ? [] : (data ?? [])),
    [data, timeToChurnError],
  );

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
    <Section
      title="Time to churn"
      description="From signing to last completed action."
      meta={
        !timeToChurnError && timeToChurnSamples.length > 0
          ? `${timeToChurnSamples.length} churned members`
          : undefined
      }
    >
      <div className="relative">
        {timeToChurnError ? (
          <p className="text-sm text-gray-600">
            {adminRefusalMessage(
              timeToChurnError,
              "Unable to load time to churn.",
            )}
          </p>
        ) : timeToChurnLoading ? (
          <p className="text-sm text-zinc-600">Loading time to churn…</p>
        ) : (
          churnDurationsWeeks.length === 0 && (
            <p className="text-sm text-gray-600">No churned members yet.</p>
          )
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
                    <title>{`${weekRange(bin)}w: ${bin.length} members`}</title>
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
      {churnHistogramGeometry && (
        <ChartData
          caption="Time to churn"
          columns={["Weeks since signing", "Churned members"]}
          rows={churnHistogramGeometry.bins.map((bin) => [
            weekRange(bin),
            String(bin.length),
          ])}
        />
      )}
    </Section>
  );
};

export default TimeToChurnCard;
