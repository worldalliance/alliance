import type { ReminderGroupDto } from "@alliance/shared/client";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { describeGroupSchedule, groupSendStart } from "./groupSchedule";

const deadline = new Date(2026, 0, 10, 12, 0);
const hour = 60 * 60;

const makeGroup = (overrides: Partial<ReminderGroupDto>): ReminderGroupDto => ({
  id: 1,
  name: "Reminder",
  timingMode: "event_launch",
  cohortType: "all_uncompleted",
  emailMessage: "",
  emailSubject: "",
  textMessage: "",
  pushMessage: "",
  send_range_start: null,
  send_range_end: null,
  sendAtAbsolute: null,
  sendAtSecondsFromDeadline: null,
  relative_range_start_seconds_from_deadline: null,
  relative_range_end_seconds_from_deadline: null,
  useSuiteTaskCount: true,
  allSent: false,
  excludeOptionalActions: false,
  excludePreviouslyNotified: false,
  memberActionEvent: {
    ...makeEvent({ date: new Date(2026, 0, 1, 9, 0).toISOString() }),
    updatedAt: new Date(2026, 0, 1).toISOString(),
  },
  isMissedSuite: false,
  ...overrides,
});

const close = makeEvent({ title: "Close", date: deadline.toISOString() });

describe("describeGroupSchedule", () => {
  it("describes an absolute send time", () => {
    const group = makeGroup({
      timingMode: "absolute",
      sendAtAbsolute: new Date(2026, 0, 2, 10, 0).toISOString(),
    });

    expect(
      describeGroupSchedule({ group, referenceEvent: null, anchorLabel: null }),
    ).toEqual({
      primary: "Sends Jan 2, 2026 10:00 AM",
      secondary: "Absolute schedule",
      pastTense: "at Jan 2, 2026 10:00 AM",
    });
  });

  it("describes an offset before the reference event", () => {
    const group = makeGroup({
      timingMode: "from_deadline",
      sendAtSecondsFromDeadline: 3 * hour,
    });

    expect(
      describeGroupSchedule({
        group,
        referenceEvent: close,
        anchorLabel: null,
      }),
    ).toEqual({
      primary: "Sends 3 hours before Close",
      secondary: "Jan 10, 2026 9:00 AM • Deadline Jan 10, 2026 12:00 PM",
      pastTense: "3 hours before Close",
    });
  });

  it("names an anchor instead of the reference event's title", () => {
    const group = makeGroup({
      timingMode: "from_deadline",
      sendAtSecondsFromDeadline: 0,
    });

    expect(
      describeGroupSchedule({
        group,
        referenceEvent: close,
        anchorLabel: "Pledge deadline",
      }).primary,
    ).toBe("Sends at Pledge deadline");
  });

  it("flags a deadline-relative group with no reference event", () => {
    const group = makeGroup({
      timingMode: "from_deadline",
      sendAtSecondsFromDeadline: hour,
    });

    expect(
      describeGroupSchedule({ group, referenceEvent: null, anchorLabel: null })
        .secondary,
    ).toBe("Error: no deadline event found to schedule from");
  });

  it("describes a fixed window", () => {
    const group = makeGroup({
      timingMode: "within_range",
      send_range_start: new Date(2026, 0, 3, 8, 0).toISOString(),
      send_range_end: new Date(2026, 0, 4, 8, 0).toISOString(),
    });

    expect(
      describeGroupSchedule({ group, referenceEvent: null, anchorLabel: null })
        .primary,
    ).toBe("Sends between Jan 3, 2026 8:00 AM and Jan 4, 2026 8:00 AM");
  });

  it("describes a window relative to the reference event", () => {
    const group = makeGroup({
      timingMode: "within_relative_range",
      relative_range_start_seconds_from_deadline: 48 * hour,
      relative_range_end_seconds_from_deadline: 24 * hour,
    });

    expect(
      describeGroupSchedule({
        group,
        referenceEvent: close,
        anchorLabel: null,
      }),
    ).toEqual({
      primary: "Sends between 2 days before and 1 day before Close",
      secondary:
        "Jan 8, 2026 12:00 PM – Jan 9, 2026 12:00 PM • Deadline Jan 10, 2026 12:00 PM",
      pastTense: "between 2 days before and 1 day before Close",
    });
  });

  it("describes a launch-time send", () => {
    expect(
      describeGroupSchedule({
        group: makeGroup({ timingMode: "event_launch" }),
        referenceEvent: null,
        anchorLabel: null,
      }).primary,
    ).toBe("Sends when launch event begins (Jan 1, 2026 9:00 AM)");
  });
});

describe("groupSendStart", () => {
  it("counts a deadline offset back from the reference event", () => {
    const group = makeGroup({
      timingMode: "from_deadline",
      sendAtSecondsFromDeadline: 3 * hour,
    });

    expect(groupSendStart(group, close)).toEqual(new Date(2026, 0, 10, 9, 0));
  });

  it("starts a relative window at its earlier edge", () => {
    const group = makeGroup({
      timingMode: "within_relative_range",
      relative_range_start_seconds_from_deadline: 48 * hour,
      relative_range_end_seconds_from_deadline: 24 * hour,
    });

    expect(groupSendStart(group, close)).toEqual(new Date(2026, 0, 8, 12, 0));
  });

  it("falls back to a fixed window's end when it has no start", () => {
    const end = new Date(2026, 0, 4, 8, 0);
    const group = makeGroup({
      timingMode: "within_range",
      send_range_end: end.toISOString(),
    });

    expect(groupSendStart(group, null)).toEqual(end);
  });

  it("has no start for a deadline-relative group with no reference event", () => {
    const group = makeGroup({
      timingMode: "from_deadline",
      sendAtSecondsFromDeadline: hour,
    });

    expect(groupSendStart(group, null)).toBeNull();
  });
});
