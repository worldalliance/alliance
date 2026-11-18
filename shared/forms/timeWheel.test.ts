import {
  TIME_WHEEL_DEFAULT,
  TimeWheelColumnKey,
  timeWheelColumns,
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
    ["09:05", ["9", "05", "AM"]],
    ["12:30", ["12", "30", "PM"]],
    ["23:59", ["11", "59", "PM"]],
    ["18:45:00", ["6", "45", "PM"]],
  ])("shows %s as %j", (value, expected) => {
    expect(shown(value)).toEqual(expected);
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
    ["09:05", TimeWheelColumnKey.Hour, "12", "00:05"],
    ["09:05", TimeWheelColumnKey.Hour, "11", "11:05"],
    ["09:05", TimeWheelColumnKey.Minute, "59", "09:59"],
    ["09:05", TimeWheelColumnKey.Meridiem, "PM", "21:05"],
    ["12:30", TimeWheelColumnKey.Meridiem, "AM", "00:30"],
    ["21:15", TimeWheelColumnKey.Hour, "12", "12:15"],
  ])("turns %s's %s wheel to %s for %s", (value, column, option, expected) => {
    expect(turn(value, column, option)).toBe(expected);
  });
});
