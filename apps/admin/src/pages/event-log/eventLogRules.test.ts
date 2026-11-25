import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  setSystemTime,
} from "bun:test";
import { eventTime, eventTypeLabel } from "./eventLogRules";

// Local-time instants, so the dates asserted hold in every time zone.
const local = (day: number, hour: number, minute = 0, second = 0) =>
  new Date(2026, 2, day, hour, minute, second).toISOString();
const now = new Date(local(10, 12));

beforeEach(() => setSystemTime(now));
afterEach(() => setSystemTime());

describe("eventTime", () => {
  it("is relative within a day, with the date and time as its tooltip", () => {
    expect(eventTime(local(10, 11, 59, 40), now).text).toBe("Just now");
    expect(eventTime(local(10, 11, 48), now).text).toBe("12m ago");
    const hours = eventTime(local(10, 7, 30), now);
    expect(hours.text).toBe("4h ago");
    expect(hours.exact).toMatch(/^Mar 10, 7:30\sAM$/);
  });

  it("is the date and time after a day", () => {
    const old = eventTime(local(8, 12), now);
    expect(old.text).toBe(old.exact);
    expect(old.text).toMatch(/^Mar 8, 12:00\sPM$/);
  });

  it("doesn't count backwards for a clock ahead of this one", () => {
    expect(eventTime(local(10, 12, 0, 20), now).text).toBe("Just now");
  });
});

it("names a type this build doesn't know as the server does", () => {
  expect(eventTypeLabel("action_comment")).toBe("Task comment");
  expect(eventTypeLabel("something_new")).toBe("something_new");
});
