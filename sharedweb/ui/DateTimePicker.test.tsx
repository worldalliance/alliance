import { formatLocalDateTime } from "./DateTimePicker";

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
beforeEach(() => {
  process.env.TZ = "America/New_York";
});
afterEach(() => {
  process.env.TZ = hostZone;
});

it("formats an instant as local wall-clock time", () => {
  const date = new Date("2026-03-10T15:04:05.000Z");
  expect(formatLocalDateTime(date, "minute")).toBe("2026-03-10T11:04");
  expect(formatLocalDateTime(date, "second")).toBe("2026-03-10T11:04:05");
});

it("reads the offset in force at the instant, not now", () => {
  expect(
    formatLocalDateTime(new Date("2026-01-10T15:00:00.000Z"), "minute"),
  ).toBe("2026-01-10T10:00");
});

it("formats no date as a blank input", () => {
  expect(formatLocalDateTime(null, "minute")).toBe("");
});
