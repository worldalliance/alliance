import { hoursInDay } from "@alliance/common/duration";
import type { ActionCompletionCurveDto } from "@alliance/shared/client/types.gen";
import { useEffect, useMemo, useState } from "react";
import {
  AVERAGE_SERIES_KEY,
  buildActionCompletionCurveChartData,
  curveDurationDays,
} from "../lib/actionCompletionCurveChartData";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { formatCount } from "../lib/formatNumber";
import {
  type GranularityMode,
  useActionCompletionCurvesAdmin,
} from "../lib/useActionCompletionCurvesAdmin";
import Button, { ButtonVariant } from "../ui/Button";
import { ChartLegend, LegendItem } from "../ui/charts/ChartLegend";
import { NumericAxisChart } from "../ui/charts/NumericAxisChart";
import { Select } from "../ui/Select";
import { Skeleton } from "../ui/Skeleton";
import { Field } from "../ui/templates/Form";
import { ViewSwitch } from "../ui/templates/List";
import {
  NumberField,
  Panel,
  PanelControls,
  PanelStack,
} from "../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../ui/templates/States";

const ALL = "all";
const DURATION_SLACK_DAYS = 3;
const GRANULARITIES = [
  { id: "hourly", label: "Cumulative by hour" },
  { id: "daily", label: "By day" },
] as const satisfies readonly { id: GranularityMode; label: string }[];
const noCurves: ActionCompletionCurveDto[] = [];

const number = (value: unknown) => (typeof value === "number" ? value : 0);
const percent = (value: unknown) => `${(number(value) * 100).toFixed(2)}%`;

const hourLabel = (hours: number) => {
  const days = Math.floor(hours / hoursInDay);
  const h = hours % hoursInDay;
  if (days === 0) return `${h}h`;
  if (h === 0) return `${days}d`;
  return `${days}d ${h}h`;
};

/**
 * How a task's completions spread over its run, against the average of every
 * task. `actionId` fixes the task, as on its record; otherwise staff pick one.
 */
export default function ActionCompletionCurveChart({
  title = "Completions through the week",
  actionId,
  showSelector = true,
  className,
}: {
  title?: string;
  actionId?: number;
  showSelector?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = useState(
    actionId !== undefined ? String(actionId) : ALL,
  );
  const [granularity, setGranularity] = useState<GranularityMode>("hourly");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const curvesQuery = useActionCompletionCurvesAdmin(granularity);
  const curves = curvesQuery.data ?? noCurves;
  // While another granularity loads, the curves on screen are the last one's, and are drawn as such.
  const [settled, setSettled] = useState(granularity);
  useEffect(() => {
    if (curvesQuery.data && !curvesQuery.isPlaceholderData)
      setSettled(granularity);
  }, [curvesQuery.data, curvesQuery.isPlaceholderData, granularity]);
  const isHourly =
    (curvesQuery.isPlaceholderData ? settled : granularity) === "hourly";
  const taskId = actionId !== undefined ? String(actionId) : selected;

  const options = useMemo(
    () =>
      curves
        .slice()
        .sort(
          (a, b) =>
            new Date(b.memberActionStartDate).getTime() -
              new Date(a.memberActionStartDate).getTime() ||
            a.actionName.localeCompare(b.actionName),
        )
        .map((curve) => ({
          id: String(curve.actionId),
          name: curve.actionName,
        })),
    [curves],
  );

  useEffect(() => {
    if (actionId !== undefined) setSelected(String(actionId));
  }, [actionId]);

  useEffect(() => {
    if (actionId !== undefined || selected === ALL) return;
    if (!options.some((option) => option.id === selected)) setSelected(ALL);
  }, [actionId, options, selected]);

  useEffect(() => {
    if (taskId === ALL) {
      setMinDays("");
      setMaxDays("");
      return;
    }
    const curve = curves.find((c) => String(c.actionId) === taskId);
    if (!curve) return;
    const days = curveDurationDays(curve);
    setMinDays(String(Math.max(0, days - DURATION_SLACK_DAYS)));
    setMaxDays(String(days + DURATION_SLACK_DAYS));
  }, [taskId, curves]);

  const chart = useMemo(
    () =>
      buildActionCompletionCurveChartData({
        curves,
        isHourly,
        selectedActionId: taskId,
        minDays: minDays !== "" ? Number(minDays) : null,
        maxDays: maxDays !== "" ? Number(maxDays) : null,
      }),
    [curves, isHourly, taskId, minDays, maxDays],
  );

  const order = [ALL, ...options.map((option) => option.id)];
  const stepTask = (direction: -1 | 1) => {
    const at = Math.max(0, order.indexOf(selected));
    setSelected(order[(at + direction + order.length) % order.length]);
  };
  const filtered = minDays !== "" || maxDays !== "";
  const average = chart.multiLineData.find((s) => s.key === AVERAGE_SERIES_KEY);
  const tasks = chart.multiLineData.filter((s) => s.key !== AVERAGE_SERIES_KEY);

  return (
    <Panel title={title} className={className}>
      <PanelStack>
        <PanelControls
          actions={
            filtered && (
              <Button
                variant={ButtonVariant.Default}
                size="small"
                onClick={() => {
                  setMinDays("");
                  setMaxDays("");
                }}
              >
                Clear duration
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-1.5">
            <span aria-hidden="true" className="font-medium">
              Show
            </span>
            <ViewSwitch
              label="Show"
              items={GRANULARITIES}
              value={granularity}
              onChange={setGranularity}
            />
          </div>
          {showSelector && actionId === undefined && (
            <Field
              label="Task"
              help="Left and right arrow keys step through the tasks."
            >
              {(control) => (
                <Select
                  {...control}
                  className="h-control-sm w-64"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "ArrowLeft" &&
                      event.key !== "ArrowRight"
                    ) {
                      return;
                    }
                    event.preventDefault();
                    stepTask(event.key === "ArrowLeft" ? -1 : 1);
                  }}
                >
                  <option value={ALL}>All tasks</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <NumberField
            label="Shortest run (days)"
            min={0}
            value={minDays}
            onChange={setMinDays}
          />
          <NumberField
            label="Longest run (days)"
            min={0}
            value={maxDays}
            onChange={setMaxDays}
          />
        </PanelControls>
        <ContentState
          loading={curvesQuery.isPending}
          skeleton={<Skeleton className="h-96 w-full" />}
          error={
            curvesQuery.isLoadingError
              ? adminRefusalMessage(curvesQuery.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load task completion curves"
          onRetry={() => void curvesQuery.refetch()}
          empty={chart.multiLineData.length === 0}
          filtered={filtered}
          onClearFilters={() => {
            setMinDays("");
            setMaxDays("");
          }}
          emptyTitle="No task completion curves yet"
        >
          <NumericAxisChart
            title={title}
            updating={curvesQuery.isPlaceholderData}
            height={360}
            multiLineData={chart.multiLineData}
            getXValue={(d) => number(d.x)}
            getYValue={(d) =>
              number(
                isHourly
                  ? d.cumulativeCompletionFraction
                  : d.completionFraction,
              )
            }
            xAxisFormat={(v) =>
              isHourly ? hourLabel(Math.round(v)) : `${Math.round(v)}d`
            }
            xRange={{ min: 0, max: chart.maxX }}
            showDataPoints={!isHourly}
            getHoverXLabel={
              isHourly ? (d) => hourLabel(number(d.x)) : undefined
            }
            yDomain={chart.yDomain}
            yAxisFormat={(v) => `${Math.round(v * 100)}%`}
            getHoverContent={(point, series) => ({
              title: series.label,
              items: [
                ...(isHourly
                  ? [
                      {
                        label: "Completed so far",
                        value: percent(point.cumulativeCompletionFraction),
                        color: series.color,
                      },
                    ]
                  : [
                      { label: "Day", value: number(point.x) },
                      {
                        label: "Completed that day",
                        value: percent(point.completionFraction),
                        color: series.color,
                      },
                      {
                        label: "Completed so far",
                        value: percent(point.cumulativeCompletionFraction),
                      },
                    ]),
                ...(series.key === AVERAGE_SERIES_KEY
                  ? [
                      {
                        label: "Tasks",
                        value: formatCount(number(point.actionCount)),
                      },
                    ]
                  : isHourly
                    ? []
                    : [
                        {
                          label: "Completed",
                          value: formatCount(number(point.completionCount)),
                        },
                        {
                          label: "Joined",
                          value: formatCount(number(point.usersJoined)),
                        },
                      ]),
              ],
            })}
          />
          <ChartLegend>
            {average && (
              <LegendItem swatch={average.color}>{average.label}</LegendItem>
            )}
            {tasks.length === 1 && (
              <LegendItem swatch={tasks[0].color}>{tasks[0].label}</LegendItem>
            )}
            {tasks.length > 1 && (
              <LegendItem swatch={tasks[0].color}>Each task</LegendItem>
            )}
          </ChartLegend>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}
