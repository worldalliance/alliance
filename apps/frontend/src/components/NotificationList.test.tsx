import type { NotificationDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import NotificationList from "./NotificationList";

const SENT = "2026-09-23T12:00:00.000Z";

const like = (id: number, readAt: string | null = null): NotificationDto => ({
  id,
  category: "likes",
  message: `like ${id}`,
  priority: "low",
  webAppLocation: "/",
  mobileAppLocation: null,
  readAt,
  createdAt: SENT,
  updatedAt: SENT,
  sendTime: SENT,
  associatedUsers: [],
  sourceType: "notification",
});

const reads: string[] = [];

serveApi(
  routes({
    "POST /notifs/read/:id": ({ params }) => {
      reads.push(params.id);
      return new Response(null, { status: 201 });
    },
  }),
);

afterEach(() => {
  reads.length = 0;
});

it("dismisses a likes group by marking only its unread likes read", async () => {
  const likes = [like(1), like(2, SENT), like(3)];
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.notificationsList(20), likes);
  client.setQueryData(queryKeys.notificationsUnreadCount(), 2);
  render(
    <NotificationList
      notifications={likes}
      handleNotifClick={() => () => {}}
    />,
    { wrapper },
  );

  fireEvent.click(screen.getByText("Dismiss"));

  await waitFor(() => expect([...reads].sort()).toEqual(["1", "3"]));
  expect(
    client.getQueryData<number>(queryKeys.notificationsUnreadCount()),
  ).toBe(0);
});
