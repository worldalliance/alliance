import type { NotificationDto } from "@alliance/shared/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, setSystemTime, test } from "bun:test";
import NotificationText from "./NotificationText";

const notification: NotificationDto = {
  id: 1,
  category: "action_event",
  message: "notification 1",
  priority: "low",
  webAppLocation: "/",
  mobileAppLocation: null,
  readAt: null,
  createdAt: "2026-09-23T12:02:00.000Z",
  updatedAt: "2026-09-23T12:02:00.000Z",
  sendTime: "2026-09-23T12:02:00.000Z",
  associatedUsers: [],
  sourceType: "notification",
};

afterEach(() => {
  cleanup();
  setSystemTime();
});

test("shows a notification dated after the browser clock as just past", () => {
  setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
  render(
    <NotificationText
      notification={notification}
      handleNotifClick={() => () => {}}
    />,
  );
  expect(screen.getByText("less than a minute ago")).toBeTruthy();
});
