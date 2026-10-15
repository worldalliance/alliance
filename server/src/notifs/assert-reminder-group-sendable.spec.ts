import { BadRequestException } from "@nestjs/common";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import { ReminderGroupTimingMode } from "src/actions/entities/reminder-group.entity";
import { assertReminderGroupSendable } from "./assert-reminder-group-sendable";

const event = Object.assign(new ActionEvent(), {
  id: 1,
  date: new Date("2026-01-10T00:00:00Z"),
});

const group = (
  overrides: Partial<Parameters<typeof assertReminderGroupSendable>[0]>,
) => ({
  timingMode: ReminderGroupTimingMode.Absolute,
  deadlineEvent: event,
  timingAnchorEvent: null,
  sendAtAbsolute: new Date("2026-01-01T00:00:00Z"),
  sendAtSecondsFromDeadline: 3600,
  send_range_start: new Date("2026-01-01T00:00:00Z"),
  send_range_end: new Date("2026-01-02T00:00:00Z"),
  relative_range_start_seconds_from_deadline: 7200,
  relative_range_end_seconds_from_deadline: 3600,
  ...overrides,
});

describe("assertReminderGroupSendable", () => {
  it.each(Object.values(ReminderGroupTimingMode))(
    "accepts %s timing with its columns set",
    (timingMode) => {
      expect(() =>
        assertReminderGroupSendable(group({ timingMode })),
      ).not.toThrow();
    },
  );

  it.each([
    [ReminderGroupTimingMode.Absolute, { sendAtAbsolute: null }],
    [ReminderGroupTimingMode.FromDeadline, { sendAtSecondsFromDeadline: null }],
    [ReminderGroupTimingMode.WithinRange, { send_range_start: null }],
    [ReminderGroupTimingMode.WithinRange, { send_range_end: null }],
    [
      ReminderGroupTimingMode.WithinRelativeRange,
      { relative_range_start_seconds_from_deadline: null },
    ],
    [
      ReminderGroupTimingMode.WithinRelativeRange,
      { relative_range_end_seconds_from_deadline: null },
    ],
  ])("rejects %s timing missing %o", (timingMode, missing) => {
    expect(() =>
      assertReminderGroupSendable(group({ timingMode, ...missing })),
    ).toThrow(BadRequestException);
  });

  it.each([
    ReminderGroupTimingMode.FromDeadline,
    ReminderGroupTimingMode.WithinRelativeRange,
  ])("rejects %s timing with no deadline or anchor", (timingMode) => {
    expect(() =>
      assertReminderGroupSendable(
        group({ timingMode, deadlineEvent: undefined }),
      ),
    ).toThrow(BadRequestException);
  });

  it("accepts relative timing with an anchor and no deadline", () => {
    expect(() =>
      assertReminderGroupSendable(
        group({
          timingMode: ReminderGroupTimingMode.FromDeadline,
          deadlineEvent: undefined,
          timingAnchorEvent: event,
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    ReminderGroupTimingMode.Absolute,
    ReminderGroupTimingMode.EventLaunch,
  ])("accepts %s timing with no deadline", (timingMode) => {
    expect(() =>
      assertReminderGroupSendable(
        group({ timingMode, deadlineEvent: undefined }),
      ),
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

  it("rejects a relative range that starts after it ends", () => {
    expect(() =>
      assertReminderGroupSendable(
        group({
          timingMode: ReminderGroupTimingMode.WithinRelativeRange,
          relative_range_start_seconds_from_deadline: 3600,
          relative_range_end_seconds_from_deadline: 7200,
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it.each([
    [
      "send range",
      {
        send_range_start: new Date("2026-01-02T00:00:00Z"),
        send_range_end: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    [
      "relative range",
      {
        relative_range_start_seconds_from_deadline: 3600,
        relative_range_end_seconds_from_deadline: 7200,
      },
    ],
  ])("rejects an inverted %s outside its timing mode", (_label, range) => {
    expect(() =>
      assertReminderGroupSendable(
        group({ timingMode: ReminderGroupTimingMode.Absolute, ...range }),
      ),
    ).toThrow(BadRequestException);
  });

  it("accepts a relative range that starts and ends at the same offset", () => {
    expect(() =>
      assertReminderGroupSendable(
        group({
          timingMode: ReminderGroupTimingMode.WithinRelativeRange,
          relative_range_start_seconds_from_deadline: 3600,
          relative_range_end_seconds_from_deadline: 3600,
        }),
      ),
    ).not.toThrow();
  });
});
