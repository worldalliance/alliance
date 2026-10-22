import { NotificationDto } from "@alliance/shared/client";
import { afterEach, expect, setSystemTime, test } from "bun:test";
import {
  buildNotificationRenderItems,
  formatNotificationTime,
} from "./notificationBucketing";

const DEVICE_NOW = "2026-09-23T12:00:00.000Z";

function notification(id: number, sendTime: string): NotificationDto {
  return {
    id,
    category: "action_event",
    message: `notification ${id}`,
    priority: "low",
    webAppLocation: "/",
    mobileAppLocation: null,
    readAt: null,
    createdAt: sendTime,
    updatedAt: sendTime,
    sendTime,
    associatedUsers: [],
    sourceType: "notification",
  };
}

afterEach(() => {
  setSystemTime();
});

test("renders a listed notification dated after the device clock", () => {
  setSystemTime(new Date(DEVICE_NOW));
  const items = buildNotificationRenderItems([
    notification(1, "2026-09-23T12:02:00.000Z"),
    notification(2, "2026-09-23T11:00:00.000Z"),
  ]);
  expect(items.map((item) => item.key)).toEqual([
    "notification-notification:1",
    "notification-notification:2",
  ]);
});

test("shows a notification dated after the device clock as just past", () => {
  setSystemTime(new Date(DEVICE_NOW));
  expect(
    formatNotificationTime(notification(1, "2026-09-23T12:02:00.000Z")),
  ).toBe("less than a minute ago");
  expect(
    formatNotificationTime(notification(2, "2026-09-23T11:00:00.000Z")),
  ).toBe("1 hour ago");
});
