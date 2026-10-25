import type { ReminderGroupClickRatePoint } from "../../lib/useReminderGroupClickRatesAdmin";
import {
  channelBars,
  pointsInRange,
  reminderActionAggregates,
  ReminderChannel,
} from "./reminderClickRateData";

const point = (
  overrides: Partial<ReminderGroupClickRatePoint>,
): ReminderGroupClickRatePoint => ({
  date: new Date(2026, 0, 15, 12),
  reminderGroupId: 1,
  reminderGroupName: "First nudge",
  actionId: 1,
  actionName: "Call a rep",
  emailClickRate: 0,
  textClickRate: 0,
  emailSentCount: 0,
  emailClickedCount: 0,
  textSentCount: 0,
  textClickedCount: 0,
  ...overrides,
});

describe("pointsInRange", () => {
  const points = [
    point({ reminderGroupId: 1, date: new Date(2026, 0, 7, 12) }),
    point({ reminderGroupId: 2, date: new Date(2026, 0, 15, 12) }),
    point({ reminderGroupId: 3, date: new Date(2026, 0, 23, 12) }),
  ];

  it("keeps the points sent within the range", () => {
    expect(
      pointsInRange(points, { start: "2026-01-10", end: "2026-01-20" }).map(
        (p) => p.reminderGroupId,
      ),
    ).toEqual([2]);
  });

  it("keeps everything without a full range and nothing for a reversed one", () => {
    expect(pointsInRange(points, { start: "", end: "2026-01-20" })).toBe(
      points,
    );
    expect(
      pointsInRange(points, { start: "2026-01-20", end: "2026-01-10" }),
    ).toEqual([]);
  });
});

describe("reminderActionAggregates", () => {
  it("orders actions last reminded on the same day by name", () => {
    expect(
      reminderActionAggregates([
        point({ actionId: 1, actionName: "Write a letter" }),
        point({ actionId: 2, actionName: "Call a rep" }),
      ]).map((aggregate) => aggregate.actionName),
    ).toEqual(["Call a rep", "Write a letter"]);
  });
});

describe("channelBars", () => {
  const aggregates = reminderActionAggregates([
    point({
      actionId: 2,
      actionName: "Later",
      date: new Date(2026, 0, 20),
      emailSentCount: 10,
      emailClickedCount: 5,
    }),
    point({
      actionId: 1,
      reminderGroupId: 1,
      emailSentCount: 4,
      emailClickedCount: 1,
      textSentCount: 2,
      textClickedCount: 2,
    }),
    point({
      actionId: 1,
      reminderGroupId: 2,
      emailSentCount: 6,
      emailClickedCount: 1,
    }),
  ]);

  it("pools each action's clicks over sends, oldest action first", () => {
    expect(channelBars(aggregates, ReminderChannel.Email)).toEqual([
      {
        actionId: 1,
        actionName: "Call a rep",
        averageRate: 0.2,
        reminderGroupCount: 2,
        sentCount: 10,
        clickedCount: 2,
      },
      {
        actionId: 2,
        actionName: "Later",
        averageRate: 0.5,
        reminderGroupCount: 1,
        sentCount: 10,
        clickedCount: 5,
      },
    ]);
  });

  it("leaves out actions never reminded over the channel", () => {
    expect(channelBars(aggregates, ReminderChannel.Text)).toEqual([
      {
        actionId: 1,
        actionName: "Call a rep",
        averageRate: 1,
        reminderGroupCount: 1,
        sentCount: 2,
        clickedCount: 2,
      },
    ]);
  });
});
