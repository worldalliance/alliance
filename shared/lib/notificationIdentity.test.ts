import { NotificationDto } from "@alliance/shared/client";
import { isClearedByContentRead } from "./notificationIdentity";
import { makeNotification } from "./testFixtures";

const SENT = "2026-09-23T12:00:00.000Z";

const notification = (overrides: Partial<NotificationDto> = {}) =>
  makeNotification({ id: 1, contentId: 10, ...overrides });

const clears = (n: NotificationDto) =>
  isClearedByContentRead({
    notification: n,
    contentType: "forum_reply",
    contentIds: new Set([10]),
  });

it("clears an unread notification for the read content", () => {
  expect(clears(notification())).toBe(true);
});

it("leaves an already-read notification alone", () => {
  expect(clears(notification({ readAt: SENT }))).toBe(false);
});

it("leaves a notification for another kind of content alone", () => {
  expect(clears(notification({ contentType: "action_update" }))).toBe(false);
});

it("leaves a notification with no content alone", () => {
  expect(clears(notification({ contentId: undefined }))).toBe(false);
});

it("leaves a notification for other content alone", () => {
  expect(clears(notification({ contentId: 11 }))).toBe(false);
});
