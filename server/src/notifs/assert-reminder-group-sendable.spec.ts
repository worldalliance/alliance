import { BadRequestException } from "@nestjs/common";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import { ReminderGroupTimingMode } from "src/actions/entities/reminder-group.entity";
import { assertReminderGroupSendable } from "./assert-reminder-group-sendable";

const group = (
  overrides: Partial<Parameters<typeof assertReminderGroupSendable>[0]>,
) => ({
  timingMode: ReminderGroupTimingMode.Absolute,
  deadlineEvent: undefined,
  timingAnchorEvent: null,
  send_range_start: null,
  send_range_end: null,
  ...overrides,
});

const event = Object.assign(new ActionEvent(), {
  id: 1,
  date: new Date("2026-01-10T00:00:00Z"),
});

describe("assertReminderGroupSendable", () => {
  it.each([
    ReminderGroupTimingMode.FromDeadline,
    ReminderGroupTimingMode.WithinRelativeRange,
  ])("rejects %s timing with no deadline or anchor", (timingMode) => {
    expect(() => assertReminderGroupSendable(group({ timingMode }))).toThrow(
      BadRequestException,
    );
  });

  it.each([
    ["a deadline", { deadlineEvent: event }],
    ["an anchor", { timingAnchorEvent: event }],
  ])("accepts relative timing with %s", (_label, reference) => {
    expect(() =>
      assertReminderGroupSendable(
        group({
          timingMode: ReminderGroupTimingMode.FromDeadline,
          ...reference,
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    ReminderGroupTimingMode.Absolute,
    ReminderGroupTimingMode.EventLaunch,
  ])("accepts %s timing with no deadline", (timingMode) => {
    expect(() =>
      assertReminderGroupSendable(group({ timingMode })),
    ).not.toThrow();
  });

  it("rejects a send range that starts after it ends", () => {
    expect(() =>
      assertReminderGroupSendable(
        group({
          timingMode: ReminderGroupTimingMode.WithinRange,
          send_range_start: new Date("2026-01-02T00:00:00Z"),
          send_range_end: new Date("2026-01-01T00:00:00Z"),
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it("accepts a send range that starts and ends at the same instant", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    expect(() =>
      assertReminderGroupSendable(
        group({
          timingMode: ReminderGroupTimingMode.WithinRange,
          send_range_start: at,
          send_range_end: at,
        }),
      ),
    ).not.toThrow();
  });
});
