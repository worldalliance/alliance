import {
  defaultEmailContents,
  defaultEmailSubject,
  defaultPushMessage,
  defaultTextMessage,
} from "@alliance/common/reminderPresetCopy";
import { draftFromInitialValues } from "./reminderGroupDraft";

const group = {
  name: "Window",
  cohortType: "custom",
  timingMode: "within_relative_range",
  relative_range_start_seconds_from_deadline: 48 * 3600,
  relative_range_end_seconds_from_deadline: 1800,
  emailSubject: "Subject",
  emailMessage: "Message",
  textMessage: "Text",
  pushMessage: "Push",
  useSuiteTaskCount: false,
  excludeOptionalActions: true,
  excludePreviouslyNotified: true,
} as const;

it("defaults a new group", () => {
  const draft = draftFromInitialValues({
    memberActionEventId: 3,
    reminderGroup: null,
    users: [],
  });

  expect(draft).toMatchObject({
    name: "",
    cohortType: "all_uncompleted",
    timingMode: "within_range",
    sendAtHoursFromDeadline: 0,
    relativeRangeStartHours: 0,
    relativeRangeEndHours: 0,
    timingAnchorEventId: null,
    emailSubject: defaultEmailSubject,
    emailMessage: defaultEmailContents,
    textMessage: defaultTextMessage,
    pushMessage: defaultPushMessage,
    userIds: [],
    userTagId: null,
    useSuiteTaskCount: true,
    excludeOptionalActions: false,
    excludePreviouslyNotified: false,
  });
  expect(Number.isNaN(new Date(draft.sendAtAbsolute).getTime())).toBe(false);
  expect(
    new Date(draft.sendRangeEnd).getTime() -
      new Date(draft.sendRangeStart).getTime(),
  ).toBeCloseTo(3600 * 1000, -2);
});

it("loads a group's fields, offsets in hours", () => {
  const {
    relative_range_start_seconds_from_deadline: _start,
    relative_range_end_seconds_from_deadline: _end,
    ...fields
  } = group;
  const draft = draftFromInitialValues({
    memberActionEventId: 3,
    reminderGroup: { ...group, userTag: { id: "tag-1" } },
    users: [{ id: 5 }, { id: 9 }],
  });

  expect(draft).toMatchObject({
    ...fields,
    relativeRangeStartHours: 48,
    relativeRangeEndHours: 0.5,
    userIds: [5, 9],
    userTagId: "tag-1",
  });
});

it("loads a group's saved send times", () => {
  const draft = draftFromInitialValues({
    memberActionEventId: 3,
    reminderGroup: {
      ...group,
      sendAtAbsolute: "2030-01-01T00:00:00.000Z",
      sendAtSecondsFromDeadline: -7200,
      send_range_start: "2030-01-02T00:00:00.000Z",
      send_range_end: "2030-01-03T00:00:00.000Z",
    },
    users: [],
  });

  expect(draft).toMatchObject({
    sendAtAbsolute: "2030-01-01T00:00:00.000Z",
    sendAtHoursFromDeadline: -2,
    sendRangeStart: "2030-01-02T00:00:00.000Z",
    sendRangeEnd: "2030-01-03T00:00:00.000Z",
  });
});

it("prefers the loaded anchor event over the anchor id", () => {
  const draft = draftFromInitialValues({
    memberActionEventId: 3,
    reminderGroup: {
      ...group,
      timingAnchorEventId: 4,
      timingAnchorEvent: { id: 6 },
    },
    users: [],
  });

  expect(draft.timingAnchorEventId).toBe(6);
});

it("falls back to the anchor id a preset sets", () => {
  const draft = draftFromInitialValues({
    memberActionEventId: 3,
    reminderGroup: { ...group, timingAnchorEventId: 4 },
    users: [],
  });

  expect(draft.timingAnchorEventId).toBe(4);
});
