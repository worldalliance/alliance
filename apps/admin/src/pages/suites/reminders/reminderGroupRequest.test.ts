import {
  draftFromInitialValues,
  type ReminderGroupDraft,
} from "./reminderGroupDraft";
import {
  reminderGroupRequestFields,
  reminderGroupSubmitPayload,
} from "./reminderGroupRequest";

const makeDraft = (overrides: Partial<ReminderGroupDraft>) => ({
  ...draftFromInitialValues({
    memberActionEventId: 3,
    reminderGroup: null,
    users: [],
  }),
  ...overrides,
});

const submitError = (
  overrides: Partial<ReminderGroupDraft>,
  memberActionEventId: number | null = 3,
) => {
  const result = reminderGroupSubmitPayload({
    draft: makeDraft(overrides),
    memberActionEventId,
  });
  return result.ok ? null : result.error;
};

it.each<[string, Partial<ReminderGroupDraft>]>([
  ["Select at least one user.", { cohortType: "custom", userIds: [] }],
  ["Select a user group.", { cohortType: "tag", userTagId: null }],
  ["Select a send time.", { timingMode: "absolute", sendAtAbsolute: "" }],
  ["Invalid send time.", { timingMode: "absolute", sendAtAbsolute: "soon" }],
  [
    "Enter the number of hours relative to the deadline.",
    { timingMode: "from_deadline", sendAtHoursFromDeadline: NaN },
  ],
  [
    "Select both the start and end of the send range.",
    { timingMode: "within_range", sendRangeEnd: "" },
  ],
  [
    "Invalid range selection.",
    { timingMode: "within_range", sendRangeStart: "soon" },
  ],
  [
    "Send range start must be before the end.",
    {
      timingMode: "within_range",
      sendRangeStart: "2030-01-02T00:00:00.000Z",
      sendRangeEnd: "2030-01-01T00:00:00.000Z",
    },
  ],
  [
    "Enter both the start and end hours before the deadline.",
    { timingMode: "within_relative_range", relativeRangeEndHours: NaN },
  ],
  [
    "Window start must be greater than or equal to the window end.",
    {
      timingMode: "within_relative_range",
      relativeRangeStartHours: 1,
      relativeRangeEndHours: 2,
    },
  ],
])("refuses to submit: %s", (message, overrides) => {
  expect(submitError(overrides)).toBe(message);
});

it("refuses to submit without an event", () => {
  expect(submitError({}, null)).toBe("Select a member action event first.");
});

it("submits a range normalized to ISO strings", () => {
  const result = reminderGroupSubmitPayload({
    draft: makeDraft({
      timingMode: "within_range",
      sendRangeStart: "2030-01-01T05:00:00+05:00",
      sendRangeEnd: "2030-01-02T00:00:00Z",
    }),
    memberActionEventId: 3,
  });

  expect(result).toEqual({
    ok: true,
    value: expect.objectContaining({
      memberActionEventId: 3,
      send_range_start: "2030-01-01T00:00:00.000Z",
      send_range_end: "2030-01-02T00:00:00.000Z",
      sendAtAbsolute: undefined,
    }),
  });
});

it("sends only the timing fields of the draft's mode, in seconds", () => {
  const fields = reminderGroupRequestFields(
    makeDraft({
      timingMode: "within_relative_range",
      relativeRangeStartHours: 48,
      relativeRangeEndHours: 24,
      sendAtHoursFromDeadline: 5,
    }),
  );

  expect(fields).toMatchObject({
    relative_range_start_seconds_from_deadline: 48 * 3600,
    relative_range_end_seconds_from_deadline: 24 * 3600,
    sendAtSecondsFromDeadline: undefined,
    send_range_start: undefined,
  });
});

it("sends recipients only for the cohort that uses them", () => {
  const draft = { userIds: [5], userTagId: "tag-1" };

  expect(
    reminderGroupRequestFields(makeDraft({ ...draft, cohortType: "custom" })),
  ).toMatchObject({ userIds: [5], userTagId: undefined });
  expect(
    reminderGroupRequestFields(makeDraft({ ...draft, cohortType: "tag" })),
  ).toMatchObject({ userIds: undefined, userTagId: "tag-1" });
});

it("sends the anchor only for deadline-relative timing", () => {
  const anchored = { timingAnchorEventId: 4 };

  expect(
    reminderGroupRequestFields(
      makeDraft({ ...anchored, timingMode: "from_deadline" }),
    ).timingAnchorEventId,
  ).toBe(4);
  expect(
    reminderGroupRequestFields(
      makeDraft({ ...anchored, timingMode: "absolute" }),
    ).timingAnchorEventId,
  ).toBeUndefined();
});

it("never excludes previously notified users for group leads", () => {
  expect(
    reminderGroupRequestFields(
      makeDraft({
        cohortType: "group_leads_with_uncompleted",
        excludePreviouslyNotified: true,
      }),
    ).excludePreviouslyNotified,
  ).toBe(false);
});

it("submits an absolute send time normalized to an ISO string", () => {
  const result = reminderGroupSubmitPayload({
    draft: makeDraft({
      timingMode: "absolute",
      sendAtAbsolute: "2030-01-01T05:00:00+05:00",
    }),
    memberActionEventId: 3,
  });

  expect(result).toEqual({
    ok: true,
    value: expect.objectContaining({
      sendAtAbsolute: "2030-01-01T00:00:00.000Z",
    }),
  });
});

it("submits hours from the deadline in seconds", () => {
  const result = reminderGroupSubmitPayload({
    draft: makeDraft({
      timingMode: "from_deadline",
      sendAtHoursFromDeadline: -2,
    }),
    memberActionEventId: 3,
  });

  expect(result).toEqual({
    ok: true,
    value: expect.objectContaining({ sendAtSecondsFromDeadline: -2 * 3600 }),
  });
});

it("submits a relative window that starts as it ends", () => {
  const result = reminderGroupSubmitPayload({
    draft: makeDraft({
      timingMode: "within_relative_range",
      relativeRangeStartHours: 24,
      relativeRangeEndHours: 24,
    }),
    memberActionEventId: 3,
  });

  expect(result).toEqual({
    ok: true,
    value: expect.objectContaining({
      relative_range_start_seconds_from_deadline: 24 * 3600,
      relative_range_end_seconds_from_deadline: 24 * 3600,
    }),
  });
});
