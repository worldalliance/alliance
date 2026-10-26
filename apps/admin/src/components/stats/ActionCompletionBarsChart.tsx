import { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { max, scaleLinear } from "d3";
import React, { useMemo, useState } from "react";
import type { useActionStats } from "../../lib/useActionStats";

type ActionStatsWithWithdrawals = ActionStatsWithOnboardingDto & {
  usersWithdrawn?: number;
};
type HoveredActionBar = {
  action: ActionStatsWithWithdrawals;
  index: number;
};

const buildRoundedLeftPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (width <= 0 || height <= 0) return "";
  return [
    `M ${x + r} ${y}`,
    `H ${x + width}`,
    `V ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
};

const buildRoundedRightPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (width <= 0 || height <= 0) return "";
  return [
    `M ${x} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x}`,
    "Z",
  ].join(" ");
};

const ActionCompletionBarsChart: React.FC<{
  actionStats: ActionStatsWithOnboardingDto[];
  actionStatsLoading: boolean;
  actionStatsLoadFailed: boolean;
  recalculateActionStats: ReturnType<typeof useActionStats>["recalculate"];
}> = ({
  actionStats,
  actionStatsLoading,
  actionStatsLoadFailed,
  recalculateActionStats,
}) => {
  const [hoveredActionBar, setHoveredActionBar] =
    useState<HoveredActionBar | null>(null);

  const chartActionStats = useMemo(
    () => actionStats.filter((a) => a.showInChart),
    [actionStats],
  );

  const actionBarsGeometry = useMemo(() => {
    if (chartActionStats.length === 0) {
      return null;
    }

    const width = 1000;
    const barHeight = 32;
    const gap = 8;
    const margin = { top: 28, right: 32, bottom: 32, left: 200 };
    const height =
      margin.top + margin.bottom + chartActionStats.length * (barHeight + gap);

    const maxCompleted = max(chartActionStats, (d) => d.usersCompleted) ?? 0;
    const maxTotalExpected = max(chartActionStats, (d) => d.usersJoined) ?? 0;
    const maxValue = Math.max(maxCompleted, maxTotalExpected, 10);

    const xScale = scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([margin.left, width - margin.right]);

    const xTicks = xScale.ticks(6);

    return {
      width,
      height,
      barHeight,
      gap,
      margin,
      xScale,
      xTicks,
      maxValue,
    };
  }, [chartActionStats]);

  const hoveredActionTooltipTop = useMemo(() => {
    if (!hoveredActionBar || !actionBarsGeometry) {
      return null;
    }
    const y =
      actionBarsGeometry.margin.top +
      hoveredActionBar.index *
        (actionBarsGeometry.barHeight + actionBarsGeometry.gap);
    const centerY = y + actionBarsGeometry.barHeight / 2;
    return (centerY / actionBarsGeometry.height) * 100;
  }, [hoveredActionBar, actionBarsGeometry]);

  return (
    <div className="relative overflow-visible rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Action Completion Stats
        </h3>
        <button
          onClick={() => recalculateActionStats.mutate()}
          disabled={actionStatsLoading}
          className="px-4 py-2 rounded-md text-sm bg-green text-white shadow hover:bg-green-2 disabled:opacity-50"
        >
          {actionStatsLoading ? "Calculating..." : "Recalculate"}
        </button>
      </div>
      <div className="relative p-4">
        {actionStatsLoading && actionStats.length === 0 && (
          <p className="text-sm text-gray-600">Loading action stats...</p>
        )}
        {actionStatsLoadFailed && (
          <p className="text-sm text-red-600">Unable to load action stats.</p>
        )}
        {recalculateActionStats.isError && (
          <p className="text-sm text-red-600">
            Unable to recalculate action stats.
          </p>
        )}
        {!actionStatsLoading &&
          !actionStatsLoadFailed &&
          actionStats.length === 0 && (
            <p className="text-sm text-gray-600">
              No action stats available. Click Recalculate to generate.
            </p>
          )}
        {actionBarsGeometry && chartActionStats.length > 0 && (
          <svg
            viewBox={`0 0 ${actionBarsGeometry.width} ${actionBarsGeometry.height}`}
            className="w-full"
          >
            <defs>
              <pattern
                id="in-progress-stripes"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill="#dbeafe" />
                <rect width="4" height="8" fill="#93c5fd" />
              </pattern>
              <pattern
                id="in-progress-stripes-hover"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill="#bfdbfe" />
                <rect width="4" height="8" fill="#60a5fa" />
              </pattern>
            </defs>
            <g>
              {actionBarsGeometry.xTicks.map((tick) => (
                <g key={`x-${tick}`}>
                  <line
                    x1={actionBarsGeometry.xScale(tick)}
                    x2={actionBarsGeometry.xScale(tick)}
                    y1={actionBarsGeometry.margin.top}
                    y2={
                      actionBarsGeometry.height -
                      actionBarsGeometry.margin.bottom
                    }
                    stroke="#f3f4f6"
                  />
                  <text
                    x={actionBarsGeometry.xScale(tick)}
                    y={
                      actionBarsGeometry.height -
                      actionBarsGeometry.margin.bottom +
                      20
                    }
                    textAnchor="middle"
                    className="fill-gray-600 text-xs"
                  >
                    {tick}
                  </text>
                </g>
              ))}
            </g>

            {chartActionStats.map((action, idx) => {
              const y =
                actionBarsGeometry.margin.top +
                idx * (actionBarsGeometry.barHeight + actionBarsGeometry.gap);
              const usersWithdrawn = action.usersWithdrawn ?? 0;
              const totalExpected = action.usersJoined + usersWithdrawn;
              const expectedWidth =
                actionBarsGeometry.xScale(totalExpected) -
                actionBarsGeometry.margin.left;
              const completedWidth =
                actionBarsGeometry.xScale(action.usersCompleted) -
                actionBarsGeometry.margin.left;
              const withdrawnWidth =
                actionBarsGeometry.xScale(usersWithdrawn) -
                actionBarsGeometry.margin.left;
              const isHovered =
                hoveredActionBar?.action.actionId === action.actionId;
              const displayRate =
                totalExpected > 0
                  ? Math.round((action.usersCompleted / totalExpected) * 100)
                  : 0;

              return (
                <g
                  key={action.actionId}
                  onMouseEnter={() =>
                    setHoveredActionBar({ action, index: idx })
                  }
                  onMouseLeave={() => setHoveredActionBar(null)}
                  className="cursor-pointer"
                >
                  {/* Invisible hover target for the full row */}
                  <rect
                    x={0}
                    y={y - actionBarsGeometry.gap / 2}
                    width={actionBarsGeometry.width}
                    height={
                      actionBarsGeometry.barHeight + actionBarsGeometry.gap
                    }
                    fill="transparent"
                  />

                  <text
                    x={actionBarsGeometry.margin.left - 8}
                    y={y + actionBarsGeometry.barHeight / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className={cn(
                      "text-xs",
                      isHovered
                        ? "fill-gray-900 font-semibold"
                        : "fill-gray-700",
                    )}
                  >
                    {action.actionName.length > 25
                      ? action.actionName.substring(0, 22) + "..."
                      : action.actionName}
                  </text>

                  <rect
                    x={actionBarsGeometry.margin.left}
                    y={y}
                    width={Math.max(expectedWidth, 0)}
                    height={actionBarsGeometry.barHeight}
                    rx={4}
                    fill={
                      action.memberActionEndDate &&
                      new Date(action.memberActionEndDate) > new Date()
                        ? isHovered
                          ? "url(#in-progress-stripes-hover)"
                          : "url(#in-progress-stripes)"
                        : isHovered
                          ? "#d1d5db"
                          : "#e5e7eb"
                    }
                  />

                  {usersWithdrawn > 0 ? (
                    Math.max(completedWidth, 0) > 0 ? (
                      <path
                        d={buildRoundedLeftPath(
                          actionBarsGeometry.margin.left,
                          y,
                          Math.max(completedWidth, 0),
                          actionBarsGeometry.barHeight,
                          4,
                        )}
                        fill={isHovered ? "#15803d" : "#16a34a"}
                      />
                    ) : null
                  ) : (
                    <rect
                      x={actionBarsGeometry.margin.left}
                      y={y}
                      width={Math.max(completedWidth, 0)}
                      height={actionBarsGeometry.barHeight}
                      rx={4}
                      fill={isHovered ? "#15803d" : "#16a34a"}
                    />
                  )}

                  {usersWithdrawn > 0 && withdrawnWidth > 0 && (
                    <path
                      d={buildRoundedRightPath(
                        actionBarsGeometry.margin.left + completedWidth,
                        y,
                        Math.max(withdrawnWidth, 0),
                        actionBarsGeometry.barHeight,
                        4,
                      )}
                      fill={isHovered ? "#ea580c" : "#f97316"}
                    />
                  )}

                  <text
                    x={
                      actionBarsGeometry.margin.left +
                      Math.max(expectedWidth, completedWidth + withdrawnWidth) +
                      8
                    }
                    y={y + actionBarsGeometry.barHeight / 2}
                    dominantBaseline="middle"
                    className="fill-gray-600 text-xs"
                  >
                    {action.usersCompleted}/{totalExpected}{" "}
                    {totalExpected > 0 ? `(${displayRate}%)` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {hoveredActionBar && hoveredActionTooltipTop !== null && (
          <div
            className="absolute right-4 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[200px] pointer-events-none"
            style={{
              top: `calc(${hoveredActionTooltipTop}% - 8px)`,
              transform: "translateY(-100%)",
            }}
          >
            <p className="font-semibold text-gray-900 mb-2 max-w-[350px]">
              {hoveredActionBar.action.actionName}
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-medium text-green-600">
                  {hoveredActionBar.action.usersCompleted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Withdrawn:</span>
                <span className="font-medium text-orange-600">
                  {hoveredActionBar.action.usersWithdrawn ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Joined:</span>
                <span className="font-medium text-gray-700">
                  {hoveredActionBar.action.usersJoined}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-gray-600">Rate:</span>
                <span className="font-semibold text-gray-900">
                  {hoveredActionBar.action.usersJoined > 0
                    ? `${Math.round(
                        (hoveredActionBar.action.usersCompleted /
                          hoveredActionBar.action.usersJoined) *
                          100,
                      )}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 px-4 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600" />
          <span className="text-sm text-gray-600">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500" />
          <span className="text-sm text-gray-600">Withdrawn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-300" />
          <span className="text-sm text-gray-600">Expected total</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 rounded" viewBox="0 0 16 16">
            <defs>
              <pattern
                id="legend-stripes"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="4" height="4" fill="#dbeafe" />
                <rect width="2" height="4" fill="#93c5fd" />
              </pattern>
            </defs>
            <rect width="16" height="16" rx="2" fill="url(#legend-stripes)" />
          </svg>
          <span className="text-sm text-gray-600">In progress</span>
        </div>
      </div>
    </div>
  );
};

export default ActionCompletionBarsChart;
