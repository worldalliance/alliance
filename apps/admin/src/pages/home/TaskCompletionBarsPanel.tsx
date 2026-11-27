import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { max, scaleLinear } from "d3";
import { useId, useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import type { useActionStats } from "../../lib/useActionStats";
import Button, { ButtonVariant } from "../../ui/Button";
import { axisTextClass, chartColor, SERIES } from "../../ui/charts/chartColor";
import { ChartFrame, useChartCursor } from "../../ui/charts/ChartFrame";
import { ChartLegend, LegendItem } from "../../ui/charts/ChartLegend";
import { ChartTip, TipRow } from "../../ui/charts/ChartTip";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { SAVE_FAILED_FALLBACK } from "../../ui/templates/Form";
import { Panel, PanelStack } from "../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";

type TaskStats = ActionStatsWithOnboardingDto;

const BAR = 28;
const GAP = 10;
const MARGIN = { top: 12, right: 112, bottom: 32, left: 200 };
const NAME_LENGTH = 25;
const [COMPLETED, WITHDRAWN] = SERIES;

const shortName = (name: string) =>
  name.length > NAME_LENGTH ? `${name.slice(0, NAME_LENGTH - 3)}...` : name;

const inProgress = (task: TaskStats) =>
  task.memberActionEndDate !== null &&
  task.memberActionEndDate !== undefined &&
  new Date(task.memberActionEndDate) > new Date();

const percentOf = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

/** The expected bar of a task still running: hatched, so it reads apart from a finished one without colour. */
function Stripes({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      width="8"
      height="8"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="8" height="8" fill={chartColor.track} />
      <rect width="3" height="8" fill={chartColor.muted} />
    </pattern>
  );
}

function geometryOf(tasks: TaskStats[], width: number) {
  const xScale = scaleLinear()
    .domain([
      0,
      Math.max(
        max(tasks, (d) => d.usersCompleted) ?? 0,
        max(tasks, (d) => d.usersJoined + d.usersWithdrawn) ?? 0,
        10,
      ) * 1.1,
    ])
    .nice()
    .range([MARGIN.left, width - MARGIN.right]);
  return {
    xScale,
    length: (count: number) => Math.max(xScale(count) - MARGIN.left, 0),
    rowY: (index: number) => MARGIN.top + index * (BAR + GAP),
    height: MARGIN.top + MARGIN.bottom + tasks.length * (BAR + GAP),
  };
}

function Bars({ tasks }: { tasks: TaskStats[] }) {
  const stripesId = useId();
  const cursor = useChartCursor(tasks.length, { vertical: true });
  const hovered = cursor.index === null ? undefined : tasks[cursor.index];

  return (
    <ChartFrame
      tip={(width) => {
        if (!hovered || cursor.index === null) return null;
        const { rowY, length } = geometryOf(tasks, width);
        const expected = hovered.usersJoined + hovered.usersWithdrawn;
        return (
          <ChartTip
            title={hovered.actionName}
            x={MARGIN.left + length(expected) / 2}
            y={rowY(cursor.index)}
          >
            <TipRow label="Completed" swatch={COMPLETED}>
              {formatCount(hovered.usersCompleted)}
            </TipRow>
            <TipRow label="Withdrawn" swatch={WITHDRAWN}>
              {formatCount(hovered.usersWithdrawn)}
            </TipRow>
            <TipRow label="Joined">{formatCount(hovered.usersJoined)}</TipRow>
            <TipRow label="Completed of joined">
              {percentOf(hovered.usersCompleted, hovered.usersJoined)}
            </TipRow>
          </ChartTip>
        );
      }}
    >
      {(width) => {
        const { xScale, length, rowY, height } = geometryOf(tasks, width);
        return (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Completed, withdrawn and expected members for each task. Up and down arrow keys read each task."
            {...cursor.markProps}
          >
            <defs>
              <Stripes id={stripesId} />
            </defs>
            {xScale.ticks(Math.max(2, Math.floor(width / 140))).map((tick) => (
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
              const y = rowY(index);
              const withdrawn = task.usersWithdrawn;
              const expected = task.usersJoined + withdrawn;
              const completedLength = length(task.usersCompleted);
              const withdrawnLength = length(withdrawn);
              return (
                <g
                  key={task.actionId}
                  onMouseEnter={() => cursor.setIndex(index)}
                  onMouseLeave={() => cursor.setIndex(null)}
                >
                  <rect
                    x={0}
                    y={y - GAP / 2}
                    width={width}
                    height={BAR + GAP}
                    className={
                      cursor.index === index
                        ? "fill-surface-2"
                        : "fill-transparent"
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
                    width={length(expected)}
                    height={BAR}
                    rx={3}
                    fill={
                      inProgress(task) ? `url(#${stripesId})` : chartColor.track
                    }
                  />
                  <rect
                    x={MARGIN.left}
                    y={y}
                    width={completedLength}
                    height={BAR}
                    rx={3}
                    fill={COMPLETED}
                  />
                  {withdrawn > 0 && (
                    <rect
                      x={MARGIN.left + completedLength}
                      y={y}
                      width={withdrawnLength}
                      height={BAR}
                      rx={3}
                      fill={WITHDRAWN}
                    />
                  )}
                  <text
                    x={
                      MARGIN.left +
                      Math.max(
                        length(expected),
                        completedLength + withdrawnLength,
                      ) +
                      8
                    }
                    y={y + BAR / 2}
                    dominantBaseline="middle"
                    className={axisTextClass}
                  >
                    {formatCount(task.usersCompleted)}/{formatCount(expected)}{" "}
                    {expected > 0
                      ? `(${percentOf(task.usersCompleted, expected)})`
                      : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
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
          <Banner
            inline
            tone={BannerTone.Danger}
            action={
              <Button
                variant={ButtonVariant.Ghost}
                size="small"
                onClick={() => recalculate.reset()}
              >
                Dismiss
              </Button>
            }
          >
            Couldn't recalculate task stats.{" "}
            {adminRefusalMessage(recalculate.error, SAVE_FAILED_FALLBACK)}
          </Banner>
        )}
        <RefreshFailedBanner inline things="task stats" query={stats} />
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
          retrying={stats.isFetching}
          empty={(stats.data ?? []).length === 0}
          emptyTitle="No task stats yet"
          emptyDescription="Select Recalculate to generate them."
        >
          {charted.length > 0 && <Bars tasks={charted} />}
          <ChartLegend>
            <LegendItem swatch={COMPLETED}>Completed</LegendItem>
            <LegendItem swatch={WITHDRAWN}>Withdrawn</LegendItem>
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
