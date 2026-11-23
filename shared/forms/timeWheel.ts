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
const MINUTE_STEP = 15;
const MINUTES = Array.from({ length: minutesInHour / MINUTE_STEP }, (_, i) =>
  String(i * MINUTE_STEP).padStart(2, "0"),
);
const MERIDIEMS = ["AM", "PM"];
const MINUTES_IN_HALF_DAY = 12 * minutesInHour;

const DEFAULT_MINUTES = 9 * minutesInHour;

const ROW_HEIGHT = 36;
const WHEEL_HEIGHT = 120;
const COLUMN_WIDTH = 56;

export type TimeWheelLayout = {
  row: number;
  height: number;
  column: number;
  /** The space above and below the selected row, which centres it. */
  edge: number;
  fade: number;
};

/** Pixel sizes of a wheel, scaled by the platform's font scale on native. */
export function timeWheelLayout(scale = 1): TimeWheelLayout {
  const row = Math.ceil(ROW_HEIGHT * scale);
  const height = Math.ceil(WHEEL_HEIGHT * scale);
  const edge = (height - row) / 2;
  return {
    row,
    height,
    column: Math.ceil(COLUMN_WIDTH * scale),
    edge,
    fade: edge / 2,
  };
}

/** The option under the band at scroll `offset`, kept within `0..last`. */
export function timeWheelIndexAt(params: {
  offset: number;
  row: number;
  last: number;
}): number {
  const { offset, row, last } = params;
  return Math.min(Math.max(Math.round(offset / row), 0), last);
}

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
      index: Math.floor((totalMinutes % minutesInHour) / MINUTE_STEP),
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
    meridiem * MINUTES_IN_HALF_DAY +
      hour12 * minutesInHour +
      minute * MINUTE_STEP,
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
