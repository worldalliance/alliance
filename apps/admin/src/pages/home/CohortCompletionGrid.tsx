import type { MemberCompletionRetentionCohortDto } from "@alliance/shared/client/types.gen";
import { max, range } from "d3";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { formatDate } from "../../lib/formatDate";
import { countOf, formatCount } from "../../lib/formatNumber";
import { heatCellClass } from "../../ui/charts/chartColor";
import { ChartTip, TipRow } from "../../ui/charts/ChartTip";
import { cn } from "../../ui/cn";
import { PanelNote } from "../../ui/templates/Overview";

type Cohort = MemberCompletionRetentionCohortDto;
type Point = Cohort["points"][number];
type Cell = { row: number; col: number };
type Active = Cell & { x: number; y: number };

const MOVES: Record<string, Cell> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

/** A date the server sends without a time, shown as that date everywhere. */
export const cohortDate = (isoDate: string) =>
  formatDate(`${isoDate}T00:00:00Z`, { timeZone: "UTC" });

const hasRate = (point: Point | undefined): point is Point =>
  point !== undefined && Number.isFinite(point.weekCompletionRate);

/**
 * Each cohort's completion rate in each week since joining, newest cohort
 * first. One tab stop: the arrow keys move between cells, and the focused or
 * hovered cell's detail shows beside it.
 */
export function CohortCompletionGrid({
  cohorts,
  weekRange,
}: {
  cohorts: Cohort[];
  weekRange: { min: number; max: number };
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [focusCell, setFocusCell] = useState<Cell>({ row: 0, col: 0 });

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
  // The grid's one tab stop stays inside it when the range or the cohorts shrink.
  const tabCell = {
    row: Math.min(focusCell.row, rows.length - 1),
    col: Math.min(focusCell.col, weeks.length - 1),
  };

  const show = (cell: Cell, element: HTMLElement) => {
    const box = boxRef.current?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (!box) return;
    setActive({
      ...cell,
      x: rect.left - box.left + rect.width / 2,
      y: rect.top - box.top,
    });
  };

  const move = (event: KeyboardEvent, from: Cell) => {
    const step = MOVES[event.key];
    if (!step) return;
    event.preventDefault();
    const to = {
      row: Math.min(rows.length - 1, Math.max(0, from.row + step.row)),
      col: Math.min(weeks.length - 1, Math.max(0, from.col + step.col)),
    };
    setFocusCell(to);
    boxRef.current
      ?.querySelector<HTMLElement>(`[data-cell="${to.row}-${to.col}"]`)
      ?.focus();
  };

  const activeRow = active ? rows[active.row] : undefined;
  const activePoint = active
    ? activeRow?.byWeek.get(weeks[active.col])
    : undefined;

  return (
    // The tip hangs from this box, outside the scroller that would clip it.
    <div ref={boxRef} className="relative">
      <div className="max-h-96 overflow-auto rounded-md border border-line">
        <table className="border-separate border-spacing-0 text-caption">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-10 h-10 w-48 border-r border-b border-line bg-surface px-2 text-left font-medium text-fg-muted"
              >
                Cohort
              </th>
              {weeks.map((week) => (
                <th
                  key={week}
                  scope="col"
                  className="sticky top-0 h-10 w-11 min-w-11 border-b border-line bg-surface font-medium text-fg-muted"
                >
                  W{week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cohort, byWeek }, row) => (
              <tr key={cohort.cohortStart}>
                <th
                  scope="row"
                  className="sticky left-0 h-10 border-r border-b border-line bg-surface px-2 text-left font-normal"
                >
                  <span className="block font-medium whitespace-nowrap">
                    Week of {cohortDate(cohort.cohortStart)}
                  </span>
                  <span className="block text-fg-muted">
                    {countOf(cohort.cohortSize, "member")}
                  </span>
                </th>
                {weeks.map((week, col) => {
                  const point = byWeek.get(week);
                  const cell = { row, col };
                  return (
                    <td
                      key={week}
                      data-cell={`${row}-${col}`}
                      tabIndex={
                        tabCell.row === row && tabCell.col === col ? 0 : -1
                      }
                      className={cn(
                        "h-10 border-b border-line text-center font-medium tabular-nums focus-ring",
                        hasRate(point)
                          ? heatCellClass(point.weekCompletionRate)
                          : "bg-surface-2",
                      )}
                      onMouseEnter={(event) => show(cell, event.currentTarget)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={(event) => {
                        setFocusCell(cell);
                        show(cell, event.currentTarget);
                      }}
                      onBlur={() => setActive(null)}
                      onKeyDown={(event) => move(event, cell)}
                    >
                      {hasRate(point)
                        ? `${Math.round(point.weekCompletionRate * 100)}%`
                        : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-live="polite">
        {active && activeRow && hasRate(activePoint) && (
          <ChartTip
            title={`Week ${activePoint.weekIndex}`}
            x={active.x}
            y={active.y}
          >
            <TipRow label="Task start">
              {cohortDate(activePoint.actionStartDate)}
            </TipRow>
            <TipRow label="Cohort">
              Week of {cohortDate(activeRow.cohort.cohortStart)}
            </TipRow>
            <TipRow label="Completed">
              {formatCount(activePoint.weekCompletedCount)}
            </TipRow>
            <TipRow label="Joined">
              {formatCount(activePoint.weekJoinedCount)}
            </TipRow>
            {(activePoint.actions ?? []).map((action) => (
              <TipRow key={action.actionId} label={action.actionName}>
                {formatCount(action.memberCount)}
              </TipRow>
            ))}
          </ChartTip>
        )}
      </div>
    </div>
  );
}
