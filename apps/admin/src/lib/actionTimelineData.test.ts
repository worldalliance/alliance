import type {
  ActionEvent,
  ActionEventDto,
  ActionStatus,
  ReminderGroupDto,
} from "@alliance/shared/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  setSystemTime,
} from "bun:test";
import { milliseconds } from "date-fns";
import {
  buildTimelineData,
  firstRowActiveInWeek,
  normalizeReminders,
  parseReminderDate,
  weekTicks,
} from "./actionTimelineData";

const NOW = new Date("2026-03-04T12:00:00.000Z");

beforeEach(() => setSystemTime(NOW));
afterEach(() => setSystemTime());

const event = (
  id: number,
  date: string,
  newStatus: ActionStatus,
): ActionEventDto => ({
  id,
  title: `Event ${id}`,
  description: "",
  newStatus,
  date,
  suiteManaged: false,
});

const action = (
  id: number,
  events: ActionEventDto[],
  status: ActionStatus = "member_action",
) => ({ id, name: `Action ${id}`, slug: `action-${id}`, status, events });

const memberActionEvent = (id: number, date: string): ActionEvent => ({
  ...event(id, date, "member_action"),
  updatedAt: date,
});

const reminder = (
  overrides: Partial<ReminderGroupDto> & Pick<ReminderGroupDto, "id">,
) => ({
  name: `Reminder ${overrides.id}`,
  timingMode: "absolute" as const,
  send_range_start: null,
  send_range_end: null,
  sendAtAbsolute: null,
  sendAtSecondsFromDeadline: null,
  memberActionEvent: memberActionEvent(900, "2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("parseReminderDate", () => {
  it("parses strings, numbers, and dates and rejects the rest", () => {
    expect(parseReminderDate("2026-01-02T00:00:00.000Z")?.toISOString()).toBe(
      "2026-01-02T00:00:00.000Z",
    );
    expect(parseReminderDate(0)?.getTime()).toBe(0);
    expect(parseReminderDate(NOW)).toBe(NOW);
    expect(parseReminderDate("not a date")).toBeNull();
    expect(parseReminderDate(new Date(Number.NaN))).toBeNull();
    expect(parseReminderDate(null)).toBeNull();
    expect(parseReminderDate("")).toBeNull();
    expect(parseReminderDate({})).toBeNull();
  });
});

describe("normalizeReminders", () => {
  it("orders a reversed send range and sorts reminders by start", () => {
    const [first, second] = normalizeReminders(
      [
        reminder({ id: 1, sendAtAbsolute: "2026-02-10T00:00:00.000Z" }),
        reminder({
          id: 2,
          timingMode: "within_range",
          send_range_start: "2026-02-05T00:00:00.000Z",
          send_range_end: "2026-02-01T00:00:00.000Z",
        }),
      ],
      [],
    );

    expect(second).toMatchObject({ id: 1, isRange: false });
    expect(first).toMatchObject({
      id: 2,
      isRange: true,
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      endDate: new Date("2026-02-05T00:00:00.000Z"),
    });
  });

  it("offsets a from-deadline reminder from the event after its member action", () => {
    const [normalized] = normalizeReminders(
      [
        reminder({
          id: 1,
          timingMode: "from_deadline",
          sendAtSecondsFromDeadline: 3600,
          memberActionEvent: memberActionEvent(10, "2026-02-01T00:00:00.000Z"),
        }),
      ],
      [
        action(1, [
          event(11, "2026-02-08T00:00:00.000Z", "resolution"),
          event(10, "2026-02-01T00:00:00.000Z", "member_action"),
        ]),
      ],
    );

    expect(normalized.startDate.toISOString()).toBe("2026-02-07T23:00:00.000Z");
  });

  it("drops a from-deadline reminder whose member action has no next event", () => {
    expect(
      normalizeReminders(
        [
          reminder({
            id: 1,
            timingMode: "from_deadline",
            sendAtSecondsFromDeadline: 3600,
            memberActionEvent: memberActionEvent(
              10,
              "2026-02-01T00:00:00.000Z",
            ),
          }),
        ],
        [action(1, [event(10, "2026-02-01T00:00:00.000Z", "member_action")])],
      ),
    ).toEqual([]);
  });

  it("places an event-launch reminder at its member action event", () => {
    const [normalized] = normalizeReminders(
      [
        reminder({
          id: 1,
          timingMode: "event_launch",
          memberActionEvent: memberActionEvent(10, "2026-02-03T00:00:00.000Z"),
        }),
      ],
      [],
    );

    expect(normalized.startDate.toISOString()).toBe("2026-02-03T00:00:00.000Z");
  });

  it("falls back to the one end of a half-open range as a point", () => {
    const [normalized] = normalizeReminders(
      [
        reminder({
          id: 1,
          timingMode: "within_range",
          send_range_end: "2026-02-05T00:00:00.000Z",
        }),
      ],
      [],
    );

    expect(normalized).toMatchObject({
      isRange: false,
      startDate: new Date("2026-02-05T00:00:00.000Z"),
      endDate: new Date("2026-02-05T00:00:00.000Z"),
    });
  });
});

describe("buildTimelineData", () => {
  const early = action(1, [
    event(2, "2026-02-10T00:00:00.000Z", "member_action"),
    event(1, "2026-02-01T00:00:00.000Z", "planned"),
  ]);
  const late = action(2, [
    event(3, "2026-01-20T00:00:00.000Z", "planned"),
    event(4, "2026-02-05T00:00:00.000Z", "member_action"),
  ]);
  const eventless = action(3, []);
  const middle = action(4, [
    event(5, "2026-01-25T00:00:00.000Z", "planned"),
    event(6, "2026-02-12T00:00:00.000Z", "member_action"),
  ]);
  const resolved = action(5, [
    event(7, "2026-02-03T00:00:00.000Z", "member_action"),
    event(8, "2026-02-20T00:00:00.000Z", "resolution"),
  ]);
  const unlaunched = action(6, [event(9, "2026-02-25T00:00:00.000Z", "draft")]);

  it("builds phases ending at the next event, or a week past now", () => {
    const { timelineData } = buildTimelineData({
      actions: [early],
      normalizedReminders: [],
      latestLaunchFirst: false,
    });

    expect(
      timelineData[0].phases.map(({ status, endDate, isActive }) => ({
        status,
        endDate: endDate.toISOString(),
        isActive,
      })),
    ).toEqual([
      {
        status: "planned",
        endDate: "2026-02-10T00:00:00.000Z",
        isActive: false,
      },
      {
        status: "member_action",
        endDate: new Date(
          NOW.getTime() + milliseconds({ days: 7 }),
        ).toISOString(),
        isActive: true,
      },
    ]);
  });

  it("orders by first event, or by latest launch when latest launch first, with eventless actions last", () => {
    const order = (latestLaunchFirst: boolean) =>
      buildTimelineData({
        actions: [eventless, unlaunched, early, resolved, late, middle],
        normalizedReminders: [],
        latestLaunchFirst,
      }).timelineData.map(({ action }) => action.id);

    expect(order(false)).toEqual([2, 4, 1, 5, 6, 3]);
    expect(order(true)).toEqual([4, 1, 2, 5, 6, 3]);
  });

  it("pads the bounds a day around events and reminders and starts at least two days before now", () => {
    const [point] = normalizeReminders(
      [reminder({ id: 1, sendAtAbsolute: "2026-01-10T00:00:00.000Z" })],
      [],
    );
    const { globalStartDate, globalEndDate, totalDays } = buildTimelineData({
      actions: [early],
      normalizedReminders: [point],
      latestLaunchFirst: false,
    });

    expect(globalStartDate.toISOString()).toBe("2026-01-09T00:00:00.000Z");
    const expectedEnd = new Date(NOW.getTime() + milliseconds({ days: 8 }));
    expect(globalEndDate.toISOString()).toBe(expectedEnd.toISOString());
    expect(totalDays).toBe(
      Math.ceil(
        (expectedEnd.getTime() - globalStartDate.getTime()) /
          milliseconds({ days: 1 }),
      ),
    );

    expect(
      buildTimelineData({
        actions: [],
        normalizedReminders: [],
        latestLaunchFirst: false,
      }).globalStartDate.toISOString(),
    ).toBe(new Date(NOW.getTime() - milliseconds({ days: 2 })).toISOString());
  });
});

describe("weekTicks", () => {
  it("places a tick at each local-midnight Tuesday in range", () => {
    const globalStartDate = new Date(2026, 2, 1, 15);
    const ticks = weekTicks({
      globalStartDate,
      globalEndDate: new Date(2026, 2, 17),
      pixelsPerDay: 16,
    });

    expect(ticks.map(({ date }) => date)).toEqual([
      new Date(2026, 2, 3),
      new Date(2026, 2, 10),
      new Date(2026, 2, 17),
    ]);
    expect(ticks[0].left).toBe(
      ((ticks[0].date.getTime() - globalStartDate.getTime()) * 16) /
        milliseconds({ days: 1 }),
    );
  });
});

describe("firstRowActiveInWeek", () => {
  const phase = (status: ActionStatus, start: Date, end: Date) => ({
    status,
    startDate: start,
    endDate: end,
    duration: end.getTime() - start.getTime(),
    isActive: false,
  });
  const row = (id: number, phases: ReturnType<typeof phase>[]) => ({
    action: { id, name: `Action ${id}`, status: "member_action" as const },
    phases,
  });
  const weekStart = new Date(2026, 2, 3);

  it("finds the first row with a shown bar overlapping the week", () => {
    expect(
      firstRowActiveInWeek(
        [
          row(1, [
            phase("planned", new Date(2026, 1, 1), new Date(2026, 2, 3)),
          ]),
          row(2, [
            phase("completed", new Date(2026, 2, 4), new Date(2026, 2, 20)),
          ]),
          row(3, [
            phase(
              "member_action",
              new Date(2026, 2, 9, 18),
              new Date(2026, 2, 20),
            ),
          ]),
        ],
        weekStart,
      ),
    ).toBe(2);
  });

  it("returns -1 when no row is active that week", () => {
    expect(
      firstRowActiveInWeek(
        [
          row(1, [
            phase("planned", new Date(2026, 2, 10), new Date(2026, 2, 20)),
          ]),
        ],
        weekStart,
      ),
    ).toBe(-1);
  });
});
