import { minutesInHour } from "date-fns/constants";
import type { FormValueUpdater } from "./formValueUpdater";
import { formatMinutesAs24h, parseTimeToMinutes } from "./timeUtils";

export enum TimeWheelColumnKey {
  Hour = "hour",
  Minute = "minute",
  Meridiem = "meridiem",
}

export type TimeWheelColumn = {
  key: TimeWheelColumnKey;
  label: string;
  options: string[];
  index: number;
};

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: minutesInHour }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MERIDIEMS = ["AM", "PM"];
const MINUTES_IN_HALF_DAY = 12 * minutesInHour;

const DEFAULT_MINUTES = 9 * minutesInHour;

export const TIME_WHEEL_DEFAULT = formatMinutesAs24h(DEFAULT_MINUTES);

/** The time a wheel shows: its `HH:MM` answer, or the default when there is none. */
export function timeWheelMinutes(value: unknown): number {
  const minutes = typeof value === "string" ? parseTimeToMinutes(value) : null;
  return minutes ?? DEFAULT_MINUTES;
}

export function timeWheelColumns(totalMinutes: number): TimeWheelColumn[] {
  const hour24 = Math.floor(totalMinutes / minutesInHour);
  return [
    {
      key: TimeWheelColumnKey.Hour,
      label: "Hour",
      options: HOURS,
      index: (hour24 + 11) % 12,
    },
    {
      key: TimeWheelColumnKey.Minute,
      label: "Minute",
      options: MINUTES,
      index: totalMinutes % minutesInHour,
    },
    {
      key: TimeWheelColumnKey.Meridiem,
      label: "AM or PM",
      options: MERIDIEMS,
      index: hour24 < 12 ? 0 : 1,
    },
  ];
}

/** The `HH:MM` answer after one column moves to `index`. */
export function turnTimeWheel(params: {
  totalMinutes: number;
  column: TimeWheelColumnKey;
  index: number;
}): string {
  const { totalMinutes, column, index } = params;
  const [hour, minute, meridiem] = timeWheelColumns(totalMinutes).map(
    (wheel) => (wheel.key === column ? index : wheel.index),
  );
  const hour12 = (hour + 1) % 12;
  return formatMinutesAs24h(
    meridiem * MINUTES_IN_HALF_DAY + hour12 * minutesInHour + minute,
  );
}

export function timeWheelControls({
  value,
  onChange,
}: {
  value: unknown;
  onChange?: (update: FormValueUpdater) => void;
}) {
  return {
    columns: timeWheelColumns(timeWheelMinutes(value)),
    // From the latest answer, so a turn that settles late cannot undo another column's.
    turn: (column: TimeWheelColumnKey, index: number) =>
      onChange?.((previous) =>
        turnTimeWheel({
          totalMinutes: timeWheelMinutes(previous),
          column,
          index,
        }),
      ),
  };
}
