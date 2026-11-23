import {
  TIME_WHEEL_DEFAULT,
  TimeWheelColumnKey,
  timeWheelColumns,
  timeWheelIndexAt,
  timeWheelMinutes,
  turnTimeWheel,
} from "./timeWheel";

const shown = (value: string) =>
  timeWheelColumns(timeWheelMinutes(value)).map(
    (column) => column.options[column.index],
  );

describe("timeWheelColumns", () => {
  it.each([
    ["00:00", ["12", "00", "AM"]],
    ["09:15", ["9", "15", "AM"]],
    ["12:30", ["12", "30", "PM"]],
    ["18:45:00", ["6", "45", "PM"]],
    ["09:05", ["9", "00", "AM"]],
    ["23:59", ["11", "45", "PM"]],
  ])("shows %s as %j", (value, expected) => {
    expect(shown(value)).toEqual(expected);
  });

  it("offers minutes in quarter hours", () => {
    const minute = timeWheelColumns(0).find(
      (column) => column.key === TimeWheelColumnKey.Minute,
    );
    expect(minute?.options).toEqual(["00", "15", "30", "45"]);
  });

  it("shows the default for a missing or unreadable answer", () => {
    expect(timeWheelMinutes(undefined)).toBe(
      timeWheelMinutes(TIME_WHEEL_DEFAULT),
    );
    expect(timeWheelMinutes("soon")).toBe(timeWheelMinutes(TIME_WHEEL_DEFAULT));
  });
});

describe("turnTimeWheel", () => {
  const turn = (value: string, column: TimeWheelColumnKey, option: string) => {
    const totalMinutes = timeWheelMinutes(value);
    const wheel = timeWheelColumns(totalMinutes).find(
      (candidate) => candidate.key === column,
    );
    if (!wheel) throw new Error(`no ${column} column`);
    return turnTimeWheel({
      totalMinutes,
      column,
      index: wheel.options.indexOf(option),
    });
  };

  it.each([
    ["09:15", TimeWheelColumnKey.Hour, "12", "00:15"],
    ["09:15", TimeWheelColumnKey.Hour, "11", "11:15"],
    ["09:15", TimeWheelColumnKey.Minute, "45", "09:45"],
    ["09:15", TimeWheelColumnKey.Meridiem, "PM", "21:15"],
    ["12:30", TimeWheelColumnKey.Meridiem, "AM", "00:30"],
    ["21:15", TimeWheelColumnKey.Hour, "12", "12:15"],
    ["08:10", TimeWheelColumnKey.Hour, "9", "09:00"],
  ])("turns %s's %s wheel to %s for %s", (value, column, option, expected) => {
    expect(turn(value, column, option)).toBe(expected);
  });
});

describe("timeWheelIndexAt", () => {
  it.each([
    [0, 0],
    [17, 0],
    [18, 1],
    [36 * 4, 4],
    [-20, 0],
    [36 * 20, 11],
  ])("puts offset %s on option %s", (offset, expected) => {
    expect(timeWheelIndexAt({ offset, row: 36, last: 11 })).toBe(expected);
  });
});
