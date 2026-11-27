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
  MIN_PHASE_BAR_WIDTH_PX,
  normalizeReminders,
  parseReminderDate,
  phaseBarBounds,
  timelineScale,
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
) => ({ id, name: `Action ${id}`, status, events });

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

  it("ends a last phase that starts after now a week past its start", () => {
    const scheduled = action(7, [
      event(10, "2026-03-20T00:00:00.000Z", "member_action"),
    ]);
    const { timelineData } = buildTimelineData({
      actions: [scheduled],
      normalizedReminders: [],
      latestLaunchFirst: false,
    });

    expect(timelineData[0].phases[0].endDate.toISOString()).toBe(
      "2026-03-27T00:00:00.000Z",
    );
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

  it("puts drafts first when latest launch first", () => {
    const draft = action(
      5,
      [event(7, "2026-01-01T00:00:00.000Z", "draft")],
      "draft",
    );
    const eventlessDraft = action(6, [], "draft");
    const { timelineData } = buildTimelineData({
      actions: [eventless, early, eventlessDraft, draft, middle],
      normalizedReminders: [],
      latestLaunchFirst: true,
    });

    expect(timelineData.map(({ action }) => action.id)).toEqual([
      5, 6, 4, 1, 3,
    ]);
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

describe("timelineScale", () => {
  const start = new Date("2026-03-01T08:00:00.000Z");
  const x = timelineScale(start, 24);

  it("places an instant at its exact time of day", () => {
    const sevenPmPacific = new Date("2026-03-03T03:00:00.000Z");
    expect(x(sevenPmPacific)).toBe(24 + 19);
  });

  it("starts a phase that began now at the now x", () => {
    expect(phaseBarBounds({ startDate: NOW, endDate: NOW }, x).left).toBe(
      x(NOW),
    );
  });

  it("lets touching phases share an edge and gives short ones a minimum width", () => {
    const join = new Date("2026-03-02T15:30:00.000Z");
    const before = phaseBarBounds({ startDate: start, endDate: join }, x);
    const after = phaseBarBounds(
      { startDate: join, endDate: new Date(join.getTime() + 60_000) },
      x,
    );
    expect(before.left + before.width).toBe(after.left);
    expect(after.width).toBe(MIN_PHASE_BAR_WIDTH_PX);
  });
});

describe("weekTicks", () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  beforeEach(() => {
    process.env.TZ = "Asia/Tokyo";
  });
  afterEach(() => {
    process.env.TZ = zone;
  });

  it("ticks at Pacific Tuesday midnight across the March change", () => {
    const globalStartDate = new Date("2026-03-01T23:00:00.000Z");
    const ticks = weekTicks({
      globalStartDate,
      globalEndDate: new Date("2026-03-18T00:00:00.000Z"),
      pixelsPerDay: 16,
    });

    expect(ticks.map(({ date }) => date.toISOString())).toEqual([
      "2026-03-03T00:00:00.000-08:00",
      "2026-03-10T00:00:00.000-07:00",
      "2026-03-17T00:00:00.000-07:00",
    ]);
    expect(ticks[0].left).toBe(
      timelineScale(globalStartDate, 16)(ticks[0].date),
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

  it("compares exact instants, not days", () => {
    expect(
      firstRowActiveInWeek(
        [
          row(1, [
            phase(
              "member_action",
              new Date(2026, 1, 20),
              new Date(2026, 2, 3, 0, 0, 1),
            ),
          ]),
        ],
        weekStart,
      ),
    ).toBe(0);
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
