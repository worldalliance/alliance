import { withCount } from "@alliance/common/plural";
import type { MemberCompletionRetentionCohortDto } from "@alliance/shared/client/types.gen";
import chroma from "chroma-js";
import { max, range } from "d3";
import { Fragment, useMemo, useRef, useState } from "react";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { ChartTip, PanelNote, TipRow } from "./chartParts";

type Cohort = MemberCompletionRetentionCohortDto;
type Point = Cohort["points"][number];
type Hovered = { x: number; y: number; cohort: Cohort; point: Point };

// A diverging ramp, not status colours: each cell also carries its number.
const heat = chroma.scale("RdYlGn").domain([0, 1]).mode("lab");
const DARK_CELL = 0.45;

/** A date the server sends without a time, shown as that date everywhere. */
export const cohortDate = (isoDate: string) =>
  formatDate(`${isoDate}T00:00:00Z`, { timeZone: "UTC" });

const hasRate = (point: Point | undefined): point is Point =>
  point !== undefined && Number.isFinite(point.weekCompletionRate);

/** Each cohort's completion rate in each week since joining, newest cohort first. */
export function CohortCompletionGrid({
  cohorts,
  weekRange,
}: {
  cohorts: Cohort[];
  weekRange: { min: number; max: number };
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);

  const weeks = useMemo(() => {
    const lastWeek =
      max(cohorts.flatMap((c) => c.points.map((p) => p.weekIndex))) ?? 0;
    const from = Math.max(0, Math.floor(weekRange.min));
    const to = Math.max(from, Math.ceil(weekRange.max));
    return from <= lastWeek ? range(from, Math.min(to, lastWeek) + 1) : [];
  }, [cohorts, weekRange]);

  const rows = useMemo(
    () =>
      [...cohorts]
        .sort(
          (a, b) =>
            new Date(b.cohortStart).getTime() -
            new Date(a.cohortStart).getTime(),
        )
        .map((cohort) => ({
          cohort,
          byWeek: new Map(cohort.points.map((p) => [p.weekIndex, p])),
        })),
    [cohorts],
  );

  if (weeks.length === 0) {
    return <PanelNote>No weeks in the selected range.</PanelNote>;
  }

  const hover = (
    event: React.MouseEvent<HTMLDivElement>,
    cohort: Cohort,
    point: Point | undefined,
  ) => {
    const grid = gridRef.current?.getBoundingClientRect();
    if (!grid || !hasRate(point)) {
      setHovered(null);
      return;
    }
    setHovered({
      x: event.clientX - grid.left,
      y: event.clientY - grid.top,
      cohort,
      point,
    });
  };

  return (
    // The tip hangs from this box, outside the scroller that would clip it.
    <div ref={gridRef} className="relative">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-max border-t border-l border-line"
          style={{
            gridTemplateColumns: `12rem repeat(${weeks.length}, 2.75rem)`,
          }}
        >
          <div className="flex h-10 items-center border-r border-b border-line px-2 text-caption font-medium text-fg-muted">
            Cohort
          </div>
          {weeks.map((week) => (
            <div
              key={week}
              className="flex h-10 items-center justify-center border-r border-b border-line text-caption font-medium text-fg-muted"
            >
              W{week}
            </div>
          ))}
          {rows.map(({ cohort, byWeek }) => (
            <Fragment key={cohort.cohortStart}>
              <div className="flex h-10 flex-col justify-center border-r border-b border-line px-2 text-caption">
                <span className="font-medium">
                  Week of {cohortDate(cohort.cohortStart)}
                </span>
                <span className="text-fg-muted">
                  {withCount(cohort.cohortSize, "member")}
                </span>
              </div>
              {weeks.map((week) => {
                const point = byWeek.get(week);
                const colour = hasRate(point)
                  ? heat(point.weekCompletionRate)
                  : null;
                return (
                  <div
                    key={week}
                    className="flex h-10 items-center justify-center border-r border-b border-line bg-surface-2 text-caption font-medium tabular-nums"
                    style={
                      colour
                        ? {
                            backgroundColor: colour.hex(),
                            color:
                              colour.luminance() < DARK_CELL
                                ? "var(--color-accent-fg)"
                                : "var(--color-fg)",
                          }
                        : undefined
                    }
                    onMouseEnter={(event) => hover(event, cohort, point)}
                    onMouseMove={(event) => hover(event, cohort, point)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {hasRate(point)
                      ? `${Math.round(point.weekCompletionRate * 100)}%`
                      : ""}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {hovered && (
        <ChartTip
          title={`Week ${hovered.point.weekIndex}`}
          className="-translate-x-1/2 -translate-y-full"
          style={{ left: hovered.x, top: hovered.y - 12 }}
        >
          <TipRow label="Task start">
            {cohortDate(hovered.point.actionStartDate)}
          </TipRow>
          <TipRow label="Cohort">
            Week of {cohortDate(hovered.cohort.cohortStart)}
          </TipRow>
          <TipRow label="Completed">
            {formatCount(hovered.point.weekCompletedCount)}
          </TipRow>
          <TipRow label="Joined">
            {formatCount(hovered.point.weekJoinedCount)}
          </TipRow>
          {(hovered.point.actions ?? []).map((action) => (
            <TipRow key={action.actionId} label={action.actionName}>
              {formatCount(action.memberCount)}
            </TipRow>
          ))}
        </ChartTip>
      )}
    </div>
  );
}
