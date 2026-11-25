import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { max, scaleLinear } from "d3";
import { useId, useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import type { useActionStats } from "../../lib/useActionStats";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import {
  axisTextClass,
  chartColor,
  ChartLegend,
  ChartTip,
  LegendItem,
  PanelStack,
  TipRow,
} from "./chartParts";

type TaskStats = ActionStatsWithOnboardingDto;

const WIDTH = 1000;
const BAR = 28;
const GAP = 10;
const MARGIN = { top: 12, right: 96, bottom: 32, left: 200 };
const NAME_LENGTH = 25;

const shortName = (name: string) =>
  name.length > NAME_LENGTH ? `${name.slice(0, NAME_LENGTH - 3)}...` : name;

const inProgress = (task: TaskStats) =>
  task.memberActionEndDate !== null &&
  task.memberActionEndDate !== undefined &&
  new Date(task.memberActionEndDate) > new Date();

function Stripes({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      width="8"
      height="8"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="8" height="8" fill={chartColor.inProgressSoft} />
      <rect width="3" height="8" fill={chartColor.inProgress} />
    </pattern>
  );
}

function Bars({ tasks }: { tasks: TaskStats[] }) {
  const stripesId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const height = MARGIN.top + MARGIN.bottom + tasks.length * (BAR + GAP);
  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([
          0,
          Math.max(
            max(tasks, (d) => d.usersCompleted) ?? 0,
            max(tasks, (d) => d.usersJoined) ?? 0,
            10,
          ) * 1.1,
        ])
        .nice()
        .range([MARGIN.left, WIDTH - MARGIN.right]),
    [tasks],
  );
  const width = (count: number) => Math.max(xScale(count) - MARGIN.left, 0);
  const hoveredTask = hovered === null ? undefined : tasks[hovered];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        role="img"
        aria-label="Completed, withdrawn and expected members for each task"
      >
        <defs>
          <Stripes id={stripesId} />
        </defs>
        {xScale.ticks(6).map((tick) => (
          <g key={tick}>
            <line
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={MARGIN.top}
              y2={height - MARGIN.bottom}
              stroke={chartColor.grid}
            />
            <text
              x={xScale(tick)}
              y={height - MARGIN.bottom + 20}
              textAnchor="middle"
              className={axisTextClass}
            >
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {tasks.map((task, index) => {
          const y = MARGIN.top + index * (BAR + GAP);
          const withdrawn = task.usersWithdrawn;
          const expected = task.usersJoined + withdrawn;
          const completedWidth = width(task.usersCompleted);
          const withdrawnWidth = width(withdrawn);
          return (
            <g
              key={task.actionId}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={0}
                y={y - GAP / 2}
                width={WIDTH}
                height={BAR + GAP}
                className={
                  hovered === index ? "fill-surface-2" : "fill-transparent"
                }
              />
              <text
                x={MARGIN.left - 8}
                y={y + BAR / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-fg text-xs"
              >
                {shortName(task.actionName)}
              </text>
              <rect
                x={MARGIN.left}
                y={y}
                width={width(expected)}
                height={BAR}
                rx={3}
                fill={
                  inProgress(task) ? `url(#${stripesId})` : chartColor.track
                }
              />
              <rect
                x={MARGIN.left}
                y={y}
                width={completedWidth}
                height={BAR}
                rx={3}
                fill={chartColor.completed}
              />
              {withdrawn > 0 && (
                <rect
                  x={MARGIN.left + completedWidth}
                  y={y}
                  width={withdrawnWidth}
                  height={BAR}
                  rx={3}
                  fill={chartColor.withdrawn}
                />
              )}
              <text
                x={
                  MARGIN.left +
                  Math.max(width(expected), completedWidth + withdrawnWidth) +
                  8
                }
                y={y + BAR / 2}
                dominantBaseline="middle"
                className={axisTextClass}
              >
                {task.usersCompleted}/{expected}{" "}
                {expected > 0
                  ? `(${Math.round((task.usersCompleted / expected) * 100)}%)`
                  : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {hoveredTask && hovered !== null && (
        <ChartTip
          title={hoveredTask.actionName}
          className="right-0 -translate-y-full"
          style={{
            top: `${((MARGIN.top + hovered * (BAR + GAP)) / height) * 100}%`,
          }}
        >
          <TipRow label="Completed">
            {formatCount(hoveredTask.usersCompleted)}
          </TipRow>
          <TipRow label="Withdrawn">
            {formatCount(hoveredTask.usersWithdrawn)}
          </TipRow>
          <TipRow label="Joined">{formatCount(hoveredTask.usersJoined)}</TipRow>
          <TipRow label="Rate">
            {hoveredTask.usersJoined > 0
              ? `${Math.round((hoveredTask.usersCompleted / hoveredTask.usersJoined) * 100)}%`
              : "—"}
          </TipRow>
        </ChartTip>
      )}
    </div>
  );
}

/** Each charted task's completions against the members expected to take it. */
export function TaskCompletionBarsPanel({
  stats,
  recalculate,
  className,
}: {
  stats: ReturnType<typeof useActionStats>["stats"];
  recalculate: ReturnType<typeof useActionStats>["recalculate"];
  className?: string;
}) {
  const legendStripesId = useId();
  const charted = useMemo(
    () => (stats.data ?? []).filter((task) => task.showInChart),
    [stats.data],
  );

  return (
    <Panel
      title="Task completion stats"
      className={className}
      action={
        <Button
          variant={ButtonVariant.Default}
          size="small"
          busy={recalculate.isPending}
          onClick={() => recalculate.mutate()}
        >
          Recalculate
        </Button>
      }
    >
      <PanelStack>
        {recalculate.isError && (
          <Banner inline tone={BannerTone.Danger}>
            {"Couldn't recalculate task stats. "}
            {adminRefusalMessage(recalculate.error, LOAD_FAILED_FALLBACK)}
          </Banner>
        )}
        <ContentState
          loading={stats.isPending}
          skeleton={<Skeleton className="h-64 w-full" />}
          error={
            stats.isLoadingError
              ? adminRefusalMessage(stats.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load task stats"
          onRetry={() => void stats.refetch()}
          empty={(stats.data ?? []).length === 0}
          emptyTitle="No task stats yet"
          emptyDescription="Select Recalculate to generate them."
        >
          {charted.length > 0 && <Bars tasks={charted} />}
          <ChartLegend>
            <LegendItem swatch={chartColor.completed}>Completed</LegendItem>
            <LegendItem swatch={chartColor.withdrawn}>Withdrawn</LegendItem>
            <LegendItem swatch={chartColor.track}>Expected total</LegendItem>
            <LegendItem
              swatch={
                <svg aria-hidden="true" className="size-3" viewBox="0 0 12 12">
                  <defs>
                    <Stripes id={legendStripesId} />
                  </defs>
                  <rect
                    width="12"
                    height="12"
                    rx="2"
                    fill={`url(#${legendStripesId})`}
                  />
                </svg>
              }
            >
              In progress
            </LegendItem>
          </ChartLegend>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}
