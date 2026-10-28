import { describe, expect, it } from "bun:test";
import { defaultReminderBodies } from "../reminders/presets";
import { reminderSendWindows, remindersBeforeLaunch } from "./launchReminders";

const schedule = {
  memberActionAt: new Date("2026-11-01T02:00:00Z"),
  officeActionAt: new Date("2026-11-08T07:59:00Z"),
};
const bodies = defaultReminderBodies({ suiteId: 3, hasDeadline: true });

describe("reminderSendWindows", () => {
  it("times each default reminder from the launch or the office action deadline", () => {
    const windows = reminderSendWindows({ bodies, schedule });
    expect(
      windows.map(({ name, start, end }) => [
        name,
        start.toISOString(),
        end.toISOString(),
      ]),
    ).toEqual([
      [
        "Member Action announcement",
        "2026-11-01T02:00:00.000Z",
        "2026-11-01T02:00:00.000Z",
      ],
      [
        "24-48h reminder",
        "2026-11-06T07:59:00.000Z",
        "2026-11-07T07:59:00.000Z",
      ],
      [
        "6-24h reminder",
        "2026-11-07T07:59:00.000Z",
        "2026-11-08T01:59:00.000Z",
      ],
      [
        "3 hour reminder",
        "2026-11-08T04:59:00.000Z",
        "2026-11-08T04:59:00.000Z",
      ],
      [
        "Missed deadline message",
        "2026-11-08T07:59:00.000Z",
        "2026-11-08T07:59:00.000Z",
      ],
      [
        "Group leads 3 days reminder",
        "2026-11-05T07:59:00.000Z",
        "2026-11-06T07:59:00.000Z",
      ],
      [
        "Group leads 2 days reminder",
        "2026-11-06T07:59:00.000Z",
        "2026-11-07T07:59:00.000Z",
      ],
    ]);
    expect(remindersBeforeLaunch(windows, schedule)).toEqual([]);
  });

  it("flags reminders a short window would send before members start", () => {
    const short = {
      ...schedule,
      officeActionAt: new Date("2026-11-03T02:00:00Z"),
    };
    expect(
      remindersBeforeLaunch(
        reminderSendWindows({ bodies, schedule: short }),
        short,
      ).map(({ name }) => name),
    ).toEqual(["Group leads 3 days reminder"]);
  });
});
