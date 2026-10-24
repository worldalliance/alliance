import { area, curveMonotoneX, extent, max, scaleLinear, scaleTime } from "d3";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import type { ParsedContractStatusPoint } from "./contractStatusHistory";

type DateRange = { start: string; end: string };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const MembersOverTimeChart: React.FC<{
  parsedContractStatusHistory: ParsedContractStatusPoint[];
  contractStatusLoading: boolean;
  contractStatusError: Error | null;
  contractStatusRange: DateRange;
  setContractStatusRange: React.Dispatch<React.SetStateAction<DateRange>>;
}> = ({
  parsedContractStatusHistory,
  contractStatusLoading,
  contractStatusError,
  contractStatusRange,
  setContractStatusRange,
}) => {
  const [hoveredContractPoint, setHoveredContractPoint] =
    useState<ParsedContractStatusPoint | null>(null);
  const contractStatusSvgRef = useRef<SVGSVGElement | null>(null);

  const contractStatusChartGeometry = useMemo(() => {
    if (parsedContractStatusHistory.length === 0) return null;

    const width = 1000;
    const height = 350;
    const margin = { top: 28, right: 32, bottom: 64, left: 72 };

    const dateExtent = extent(parsedContractStatusHistory, (d) => d.parsedDate);
    if (!dateExtent[0] || !dateExtent[1]) return null;

    const xScale = scaleTime()
      .domain(dateExtent)
      .range([margin.left, width - margin.right]);

    const maxTotal =
      max(parsedContractStatusHistory, (d) => d.totalEverSigned) ?? 10;

    const yScale = scaleLinear()
      .domain([0, maxTotal * 1.1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const activeArea = area<(typeof parsedContractStatusHistory)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.activeCount))
      .curve(curveMonotoneX);

    const churnedArea = area<(typeof parsedContractStatusHistory)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0((d) => yScale(d.activeCount))
      .y1((d) => yScale(d.activeCount + d.churnedCount))
      .curve(curveMonotoneX);

    const activeAreaPath = activeArea(parsedContractStatusHistory) ?? "";
    const churnedAreaPath = churnedArea(parsedContractStatusHistory) ?? "";

    const xTicks = xScale.ticks(8);
    const yTicks = yScale.ticks(6);

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      activeAreaPath,
      churnedAreaPath,
      xTicks,
      yTicks,
      maxTotal,
    };
  }, [parsedContractStatusHistory]);

  const handleContractStatusHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (
        !contractStatusChartGeometry ||
        parsedContractStatusHistory.length === 0 ||
        !contractStatusSvgRef.current
      ) {
        return;
      }

      const rect = contractStatusSvgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      if (relativeX < 0) return;

      const scaleX = contractStatusChartGeometry.width / rect.width;
      const pointerX = relativeX * scaleX;

      const hoveredDate = contractStatusChartGeometry.xScale.invert(pointerX);

      let closestPoint = parsedContractStatusHistory[0];
      let closestDistance = Math.abs(
        hoveredDate.getTime() - closestPoint.parsedDate.getTime(),
      );

      for (const point of parsedContractStatusHistory) {
        const distance = Math.abs(
          hoveredDate.getTime() - point.parsedDate.getTime(),
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = point;
        }
      }

      setHoveredContractPoint(closestPoint);
    },
    [contractStatusChartGeometry, parsedContractStatusHistory],
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Members over time</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">From</label>
            <input
              type="date"
              value={contractStatusRange.start}
              onChange={(e) =>
                setContractStatusRange((prev) => ({
                  ...prev,
                  start: e.target.value,
                }))
              }
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">To</label>
            <input
              type="date"
              value={contractStatusRange.end}
              onChange={(e) =>
                setContractStatusRange((prev) => ({
                  ...prev,
                  end: e.target.value,
                }))
              }
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            />
          </div>
        </div>
      </div>
      <div className="relative p-4 pb-0">
        {contractStatusLoading && parsedContractStatusHistory.length === 0 && (
          <p className="text-sm text-gray-600">Loading...</p>
        )}
        {contractStatusError && (
          <p className="text-sm text-red-600">
            {adminRefusalMessage(
              contractStatusError,
              "Unable to load members over time.",
            )}
          </p>
        )}
        {!contractStatusLoading &&
          !contractStatusError &&
          parsedContractStatusHistory.length === 0 && (
            <p className="text-sm text-gray-600">
              No contract status data in this date range.
            </p>
          )}
        {contractStatusChartGeometry &&
          parsedContractStatusHistory.length > 0 && (
            <svg
              ref={contractStatusSvgRef}
              viewBox={`0 0 ${contractStatusChartGeometry.width} ${contractStatusChartGeometry.height}`}
              className="w-full"
              onMouseMove={handleContractStatusHover}
              onMouseLeave={() => setHoveredContractPoint(null)}
            >
              <g>
                {contractStatusChartGeometry.yTicks.map((tick) => (
                  <g key={`contract-y-${tick}`}>
                    <line
                      x1={contractStatusChartGeometry.margin.left}
                      x2={
                        contractStatusChartGeometry.width -
                        contractStatusChartGeometry.margin.right
                      }
                      y1={contractStatusChartGeometry.yScale(tick)}
                      y2={contractStatusChartGeometry.yScale(tick)}
                      stroke="#e5e7eb"
                      strokeDasharray="4 6"
                    />
                    <text
                      x={contractStatusChartGeometry.margin.left - 12}
                      y={contractStatusChartGeometry.yScale(tick)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-gray-500 text-xs"
                    >
                      {tick}
                    </text>
                  </g>
                ))}
                {contractStatusChartGeometry.xTicks.map((tick) => (
                  <g key={`contract-x-${tick.toISOString()}`}>
                    <line
                      x1={contractStatusChartGeometry.xScale(tick)}
                      x2={contractStatusChartGeometry.xScale(tick)}
                      y1={contractStatusChartGeometry.margin.top}
                      y2={
                        contractStatusChartGeometry.height -
                        contractStatusChartGeometry.margin.bottom
                      }
                      stroke="#f3f4f6"
                    />
                    <text
                      x={contractStatusChartGeometry.xScale(tick)}
                      y={
                        contractStatusChartGeometry.height -
                        contractStatusChartGeometry.margin.bottom +
                        24
                      }
                      textAnchor="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {dateFormatter.format(tick)}
                    </text>
                  </g>
                ))}
              </g>

              <path
                d={contractStatusChartGeometry.churnedAreaPath}
                fill="rgba(239, 68, 68, 0.9)"
                stroke="none"
              />

              <path
                d={contractStatusChartGeometry.activeAreaPath}
                fill="rgba(22, 163, 74, 0.8)"
                stroke="none"
              />

              {hoveredContractPoint && (
                <>
                  <line
                    x1={contractStatusChartGeometry.xScale(
                      hoveredContractPoint.parsedDate,
                    )}
                    x2={contractStatusChartGeometry.xScale(
                      hoveredContractPoint.parsedDate,
                    )}
                    y1={contractStatusChartGeometry.margin.top}
                    y2={
                      contractStatusChartGeometry.height -
                      contractStatusChartGeometry.margin.bottom
                    }
                    stroke="#6b7280"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />

                  <rect
                    x={Math.min(
                      contractStatusChartGeometry.xScale(
                        hoveredContractPoint.parsedDate,
                      ) + 12,
                      contractStatusChartGeometry.width - 130,
                    )}
                    y={contractStatusChartGeometry.margin.top + 12}
                    width={118}
                    height={48}
                    rx={6}
                    fill="white"
                    stroke="#e5e7eb"
                  />
                  <text
                    x={Math.min(
                      contractStatusChartGeometry.xScale(
                        hoveredContractPoint.parsedDate,
                      ) + 24,
                      contractStatusChartGeometry.width - 118,
                    )}
                    y={contractStatusChartGeometry.margin.top + 31}
                    className="fill-black text-sm font-semibold"
                  >
                    {hoveredContractPoint.totalEverSigned > 0
                      ? `${Math.round(
                          (hoveredContractPoint.churnedCount /
                            hoveredContractPoint.totalEverSigned) *
                            100,
                        )}% churn`
                      : "0% churn"}
                  </text>
                  <text
                    x={Math.min(
                      contractStatusChartGeometry.xScale(
                        hoveredContractPoint.parsedDate,
                      ) + 24,
                      contractStatusChartGeometry.width - 118,
                    )}
                    y={contractStatusChartGeometry.margin.top + 50}
                    className="fill-gray-500 text-xs"
                  >
                    {hoveredContractPoint.activeCount} members
                  </text>
                </>
              )}
            </svg>
          )}
      </div>
      <div className="flex items-center gap-6 px-4 pb-4 -mt-4">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "rgba(22, 163, 74, 0.8)" }}
          />
          <span className="text-sm text-gray-600">Active Members</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.9)" }}
          />
          <span className="text-sm text-gray-600">Churned Members</span>
        </div>
      </div>
    </div>
  );
};

export default MembersOverTimeChart;
