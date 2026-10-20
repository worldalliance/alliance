import type { NotificationDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import NotificationsPage from "./NotificationsPage";

const SENT = "2026-09-23T12:00:00.000Z";

const notification: NotificationDto = {
  id: 1,
  category: "action_event",
  message: "A reminder",
  priority: "low",
  webAppLocation: "/",
  mobileAppLocation: null,
  readAt: null,
  createdAt: SENT,
  updatedAt: SENT,
  sendTime: SENT,
  associatedUsers: [],
  sourceType: "notification",
};

let listServed = Promise.resolve();

serveApi(
  routes({
    "GET /notifs": async () => {
      await listServed;
      return Response.json([notification]);
    },
  }),
);

afterEach(() => {
  listServed = Promise.resolve();
});

it("shows a spinner until the whole list loads", async () => {
  const list = Promise.withResolvers<void>();
  listServed = list.promise;
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );

  expect(screen.getByRole("status")).toBeTruthy();
  list.resolve();
  expect(await screen.findByText("Mark all as read")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
