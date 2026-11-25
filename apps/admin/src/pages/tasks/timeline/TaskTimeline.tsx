import { addWeeks, milliseconds } from "date-fns";
import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";
import {
  firstRowActiveInWeek,
  type NormalizedReminder,
  timelineScale,
  weekTicks,
} from "../../../lib/actionTimelineData";
import type { CohortSegment } from "../../../lib/describeCohortExpression";
import { taskHref } from "../../../lib/hrefs";
import { cn } from "../../../ui/cn";
import { nameLinkClass } from "../../../ui/styles";
import { zIndex } from "../../../ui/zIndex";
import TaskRowMeta from "./TaskRowMeta";
import { TimelineBars } from "./TimelineBars";
import { TimelineGroupHeader } from "./TimelineGroupHeader";
import { TimelineReminders } from "./TimelineReminders";
import { TimelineWeeks } from "./TimelineWeeks";
import {
  GROUP_PX,
  NAME_COLUMN_PX,
  PIXELS_PER_DAY,
  ROW_PX,
  rowTops,
  type TimelineGroup,
} from "./timelineRules";

export type TaskTimelineProps = {
  /** The chart's accessible name. */
  label: string;
  groups: TimelineGroup[];
  /** A header row above each group; off for a timeline of one suite. */
  groupHeaders: boolean;
  range: { start: Date; end: Date };
  /** Above the names, left of the weeks: the timeline's own controls. */
  corner: ReactNode;
  reminders?: NormalizedReminder[];
  onReminderClick?: (reminderId: number) => void;
  participantsById?: ReadonlyMap<number, CohortSegment[]>;
  className?: string;
  /** In place of the rows when there are none; the header stays, so focus in the corner does too. */
  empty?: ReactNode;
};

/**
 * Tasks down, weeks across, in one scrolling box: the names stay at the left
 * and the weeks at the top, so the two always scroll together.
 */
export function TaskTimeline({
  label,
  groups,
  groupHeaders,
  range,
  corner,
  reminders = [],
  onReminderClick,
  participantsById,
  className,
  empty,
}: TaskTimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const centred = useRef(false);
  const [now] = useState(() => new Date());
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const start = range.start;
  // Room for a last phase drawn a week past now, and for now to sit centred on a wide screen.
  const endTime =
    Math.max(range.end.getTime(), now.getTime()) + milliseconds({ weeks: 6 });
  const x = useMemo(() => timelineScale(start, PIXELS_PER_DAY), [start]);
  const nowPx = x(now);
  const ticks = useMemo(
    () =>
      weekTicks({
        globalStartDate: start,
        globalEndDate: new Date(endTime),
        pixelsPerDay: PIXELS_PER_DAY,
      }),
    [start, endTime],
  );
  const lastTick = ticks.at(-1);
  const chartPx = Math.ceil(x(lastTick ? addWeeks(lastTick.date, 1) : endTime));
  const rows = groups.flatMap((group) => group.rows);
  const isEmpty = rows.length === 0 && reminders.length === 0;
  const tops = rowTops({ groups, withHeaders: groupHeaders });
  const bodyPx =
    rows.length * ROW_PX + (groupHeaders ? groups.length * GROUP_PX : 0);

  const centreOnNow = () => {
    const box = scroller.current;
    if (!box) return;
    box.scrollLeft = Math.max(
      0,
      nowPx - (box.clientWidth - NAME_COLUMN_PX) / 2,
    );
  };

  // Once, when the first rows land: a refetch must not move what is in view.
  useLayoutEffect(() => {
    if (centred.current || rows.length === 0) return;
    centred.current = true;
    centreOnNow();
  });

  const jumpToWeek = (weekStart: Date) => {
    const index = firstRowActiveInWeek(rows, weekStart);
    if (index === -1 || !scroller.current) return;
    const id = rows[index].action.id;
    scroller.current.scrollTop = tops.get(id) ?? 0;
    scroller.current
      .querySelector<HTMLElement>(`[data-task-link="${id}"]`)
      ?.focus({ preventScroll: true });
  };

  const highlight = (project: { id: number } | null | undefined) =>
    setHighlighted(project?.id ?? null);

  return (
    <div
      ref={scroller}
      role="region"
      aria-label={label}
      className={cn("relative min-h-0 overflow-auto bg-surface", className)}
    >
      <div
        className="relative"
        style={{ width: `max(100%, ${NAME_COLUMN_PX + chartPx}px)` }}
      >
        <div
          className={cn(
            "sticky top-0 flex h-16 border-b border-line bg-surface-2",
            zIndex.nav,
          )}
        >
          <div
            className={cn(
              "sticky left-0 flex w-80 shrink-0 items-center gap-2 border-r border-line bg-surface-2 pr-4",
              zIndex.raised,
            )}
          >
            {corner}
          </div>
          <div className="relative shrink-0" style={{ width: `${chartPx}px` }}>
            <TimelineWeeks
              ticks={ticks}
              x={x}
              now={now}
              onJump={jumpToWeek}
              onNow={centreOnNow}
            />
          </div>
        </div>

        {!isEmpty && (
          <div className="relative" style={{ height: `${bodyPx}px` }}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              {ticks.map(({ date, left }) => (
                <span
                  key={date.getTime()}
                  className="absolute inset-y-0 border-l border-line"
                  style={{ left: `${NAME_COLUMN_PX + left}px` }}
                />
              ))}
            </div>
            {groups.map((group) => (
              <div key={group.key} role="group" aria-label={group.name}>
                {groupHeaders && <TimelineGroupHeader group={group} x={x} />}
                {group.rows.map((row) => (
                  <div
                    key={row.action.id}
                    data-task-row
                    data-highlighted={
                      row.action.project != null &&
                      row.action.project.id === highlighted
                        ? ""
                        : undefined
                    }
                    className="group flex h-14 border-b border-line hover:bg-surface-2 data-highlighted:bg-surface-2"
                    onMouseEnter={() => highlight(row.action.project)}
                    onMouseLeave={() => highlight(null)}
                    onFocus={() => highlight(row.action.project)}
                    onBlur={() => highlight(null)}
                  >
                    <div
                      className={cn(
                        "sticky left-0 flex w-80 shrink-0 flex-col justify-center gap-1 border-r border-line bg-surface px-page group-hover:bg-surface-2 group-data-highlighted:bg-surface-2",
                        zIndex.raised,
                      )}
                    >
                      <Link
                        to={taskHref(row.action.id)}
                        data-task-link={row.action.id}
                        title={row.action.name}
                        className={cn(nameLinkClass, "scroll-mt-16 truncate")}
                      >
                        {row.action.name}
                      </Link>
                      <TaskRowMeta
                        status={row.action.status}
                        archived={row.action.archived}
                        participants={participantsById?.get(row.action.id)}
                      />
                    </div>
                    <div
                      className="relative shrink-0"
                      style={{ width: `${chartPx}px` }}
                    >
                      <TimelineBars row={row} x={x} now={now} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <TimelineReminders
              reminders={reminders}
              x={x}
              onReminderClick={onReminderClick}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-fg"
              style={{ left: `${NAME_COLUMN_PX + nowPx}px` }}
            />
          </div>
        )}
      </div>
      {isEmpty && <div className="sticky left-0">{empty}</div>}
    </div>
  );
}
