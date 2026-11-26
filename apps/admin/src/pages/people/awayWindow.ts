import { TZDate } from "@date-fns/tz";
import { addDays, isTuesday, nextTuesday, set } from "date-fns";
import { useCallback } from "react";
import { useLocation, useSearchParams } from "react-router";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";

/** Next Tuesday, today included, 7pm through the Tuesday after at 11:59pm, Pacific time. */
export const defaultAwayWindow = (now: Date) => {
  const today = new TZDate(now, LAUNCH_TIME_ZONE);
  const tuesday = isTuesday(today) ? today : nextTuesday(today);
  const at = (day: Date, hours: number, minutes: number) =>
    new Date(
      set(day, { hours, minutes, seconds: 0, milliseconds: 0 }).getTime(),
    );
  return { from: at(tuesday, 19, 0), to: at(addDays(tuesday, 7), 23, 59) };
};

export type AwayWindow = ReturnType<typeof defaultAwayWindow>;

const parseInstant = (raw: string | null) => {
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * The Away tab's window, kept in `?from=` and `?to=` as instants; an end left
 * out, or one that doesn't parse, takes the default's.
 */
export function useAwayWindow(now: Date) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useLocation();
  const fallback = defaultAwayWindow(now);
  const window: AwayWindow = {
    from: parseInstant(searchParams.get("from")) ?? fallback.from,
    to: parseInstant(searchParams.get("to")) ?? fallback.to,
  };
  const setEnd = useCallback(
    (end: keyof AwayWindow, date: Date) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(end, date.toISOString());
          return next;
        },
        { replace: true, state },
      ),
    [setSearchParams, state],
  );
  return { window, setEnd };
}
