import { addWeeks, getDayOfYear } from "date-fns";
import { type KeyboardEvent, useRef, useState } from "react";
import { formatDate, formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import type { XForTime } from "./timelineRules";

type Tick = { date: Date; left: number };

const STEP: Record<string, (index: number, last: number) => number> = {
  ArrowLeft: (index) => Math.max(index - 1, 0),
  ArrowRight: (index, last) => Math.min(index + 1, last),
  Home: () => 0,
  End: (_, last) => last,
};

/**
 * The week ticks, one tab stop (ARIA toolbar): arrows move between weeks, so a
 * keyboard reaches the rows without passing every week.
 */
export function TimelineWeeks({
  ticks,
  x,
  now,
  onJump,
  onNow,
}: {
  ticks: Tick[];
  x: XForTime;
  now: Date;
  onJump: (weekStart: Date) => void;
  onNow: () => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const nowIndex = Math.max(
    ticks.filter((tick) => tick.date <= now).length - 1,
    0,
  );
  const [active, setActive] = useState<number | null>(null);
  const activeIndex = ticks.findIndex((tick) => tick.date.getTime() === active);
  const current = activeIndex === -1 ? nowIndex : activeIndex;

  const onKeyDown = (event: KeyboardEvent) => {
    const step = STEP[event.key];
    if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const next = step(current, ticks.length - 1);
    setActive(ticks[next].date.getTime());
    buttons.current[next]?.focus();
  };

  return (
    <>
      <div role="toolbar" aria-label="Weeks" onKeyDown={onKeyDown}>
        {ticks.map(({ date, left }, index) => {
          const week = Math.ceil(getDayOfYear(date) / 7) + 1;
          const day = formatDate(date, { timeZone: LAUNCH_TIME_ZONE });
          return (
            <button
              type="button"
              key={date.getTime()}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              tabIndex={index === current ? 0 : -1}
              onFocus={() => setActive(date.getTime())}
              onClick={() => onJump(date)}
              aria-label={`Jump to the first task active in week ${week}, ${day}`}
              className="absolute inset-y-0 flex scroll-ml-80 flex-col justify-start border-l border-line px-2 pt-1.5 text-left text-caption text-fg-muted focus-ring hover:bg-surface hover:text-fg"
              style={{
                left: `${left}px`,
                width: `${x(addWeeks(date, 1)) - left}px`,
              }}
            >
              <span className="font-medium text-fg">{day}</span>
              <span>Week {week}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onNow}
        aria-label="Scroll to now"
        title={`Now: ${formatDateTime(now, { timeZone: LAUNCH_TIME_ZONE })}`}
        className="absolute bottom-1 -translate-x-1/2 rounded-sm bg-fg px-1 text-caption font-medium text-surface focus-ring"
        style={{ left: `${x(now)}px` }}
      >
        Now
      </button>
    </>
  );
}
