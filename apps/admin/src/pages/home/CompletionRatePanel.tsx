import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import type { useActionStats } from "../../lib/useActionStats";
import { Skeleton } from "../../ui/Skeleton";
import { DateAxisChart } from "../../ui/charts/DateAxisChart";
import { SERIES } from "../../ui/charts/chartColor";
import type { ChartSeries, DataPoint } from "../../ui/charts/types";
import { CheckboxField } from "../../ui/templates/Form";
import {
  DateRangeFields,
  Panel,
  PanelControls,
  PanelNote,
  PanelStack,
} from "../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import {
  cumulativeCompletionPoints,
  paddedRateDomain,
  weeklyCompletionPoints,
} from "./completionRateData";
import { lastMonths } from "./homeRules";

const NAME_LENGTH = 40;
const HEIGHT = 300;
const FULL_DOMAIN: [number, number] = [0, 1];
const NO_STATS: ActionStatsWithOnboardingDto[] = [];

const number = (value: unknown) => (typeof value === "number" ? value : 0);
const rate = (value: unknown) => `${(number(value) * 100).toFixed(2)}%`;
const axisRate = (value: number) => `${Math.round(value * 100)}%`;

const taskNameItems = (point: DataPoint) => {
  const names = Array.isArray(point.actionNames) ? point.actionNames : [];
  return names.map((name, index) => ({
    label: `Task ${index + 1}`,
    value:
      String(name).length > NAME_LENGTH
        ? `${String(name).slice(0, NAME_LENGTH).trimEnd()}...`
        : String(name),
  }));
};

const CUMULATIVE: ChartSeries[] = [
  {
    key: "avgRate",
    label: "Average rate",
    color: SERIES[0],
    getValue: (d) => number(d.avgRate),
  },
];
const WEEKLY: ChartSeries[] = [
  {
    key: "weekRate",
    label: "Weekly rate",
    color: SERIES[0],
    getValue: (d) => number(d.weekRate),
  },
];

function Chart({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h4 className="font-semibold">{title}</h4>
      {empty ? (
        <PanelNote>No completed tasks in this date range.</PanelNote>
      ) : (
        children
      )}
    </section>
  );
}

/** The running average and each week's completion rate, over one range. */
export function CompletionRatePanel({
  stats,
  className,
}: {
  stats: ReturnType<typeof useActionStats>["stats"];
  className?: string;
}) {
  const [absolute, setAbsolute] = useState(false);
  const [range, setRange] = useState(() => lastMonths(5));
  const actionStats = stats.data ?? NO_STATS;

  const cumulative = useMemo(
    () => cumulativeCompletionPoints(actionStats, range, new Date()),
    [actionStats, range],
  );
  const weekly = useMemo(
    () => weeklyCompletionPoints(actionStats, range, new Date()),
    [actionStats, range],
  );
  const domainOf = (rates: number[]) =>
    absolute ? FULL_DOMAIN : paddedRateDomain(rates);

  return (
    <Panel title="Completion rate" className={className}>
      <PanelStack>
        <PanelControls
          actions={
            <CheckboxField
              label="Absolute"
              help="Draw both charts on a 0–100% axis."
              checked={absolute}
              onChange={(event) => setAbsolute(event.target.checked)}
            />
          }
        >
          <DateRangeFields range={range} onChange={setRange} />
        </PanelControls>
        <RefreshFailedBanner inline things="completion rates" query={stats} />
        <ContentState
          loading={stats.isPending}
          skeleton={<Skeleton className="h-82.25 w-full" />}
          error={
            stats.isLoadingError
              ? adminRefusalMessage(stats.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load completion rates"
          onRetry={() => void stats.refetch()}
          retrying={stats.isFetching}
        >
          <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
            <Chart
              title="Cumulative completion rate"
              empty={!cumulative.length}
            >
              <DateAxisChart
                title="Cumulative completion rate"
                height={HEIGHT}
                data={cumulative}
                series={CUMULATIVE}
                showArea
                areaSeriesKey="avgRate"
                yDomain={domainOf(cumulative.map((d) => d.avgRate))}
                yAxisFormat={axisRate}
                showHoverOnlyOnHover
                yTickLabelDedup
                getHoverContent={(point) => ({
                  title: point.date ? formatDate(point.date) : "",
                  items: [
                    {
                      label: "Average rate",
                      value: rate(point.avgRate),
                      color: SERIES[0],
                    },
                    {
                      label: "Total tasks",
                      value: formatCount(number(point.actionCount)),
                    },
                    ...taskNameItems(point),
                  ],
                })}
              />
            </Chart>
            <Chart title="Weekly completion rate" empty={!weekly.length}>
              <DateAxisChart
                title="Weekly completion rate"
                height={HEIGHT}
                data={weekly}
                series={WEEKLY}
                yDomain={domainOf(weekly.map((d) => d.weekRate))}
                yAxisFormat={axisRate}
                showHoverOnlyOnHover
                yTickLabelDedup
                getHoverContent={(point) => ({
                  title: point.date ? `Week of ${formatDate(point.date)}` : "",
                  items: [
                    {
                      label: "Weekly rate",
                      value: rate(point.weekRate),
                      color: SERIES[0],
                    },
                    {
                      label: "Tasks",
                      value: formatCount(number(point.actionCount)),
                    },
                    {
                      label: "Completed / joined",
                      value: `${formatCount(number(point.completedCount))}/${formatCount(number(point.joinedCount))}`,
                    },
                    ...taskNameItems(point),
                  ],
                })}
              />
            </Chart>
          </div>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}
