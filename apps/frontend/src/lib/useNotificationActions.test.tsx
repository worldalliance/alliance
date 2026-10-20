import type { NotificationDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { useNotificationActions } from "./useNotificationActions";

const SENT = "2026-09-23T12:00:00.000Z";

const friendRequest: NotificationDto = {
  id: 1,
  category: "friend_request",
  message: "A friend request",
  priority: "low",
  webAppLocation: "member/7",
  mobileAppLocation: null,
  readAt: null,
  createdAt: SENT,
  updatedAt: SENT,
  sendTime: SENT,
  associatedUsers: [],
  sourceType: "notification",
};

const reads: string[] = [];
let readAlls = 0;

serveApi(
  routes({
    "POST /notifs/read/:id": ({ params }) => {
      reads.push(params.id);
      return new Response(null, { status: 201 });
    },
    "POST /notifs/read-all": () => {
      readAlls++;
      return new Response(null, { status: 201 });
    },
  }),
);

afterEach(() => {
  reads.length = 0;
  readAlls = 0;
});

const renderActions = () => {
  const { client, wrapper: QueryWrapper } = queryWrapper();
  client.setQueryData(queryKeys.notificationsList(20), [friendRequest]);
  client.setQueryData(queryKeys.notificationsUnreadCount(), 1);
  const rendered = renderHook(
    () => ({ actions: useNotificationActions(), location: useLocation() }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryWrapper>
      ),
    },
  );
  return { client, ...rendered };
};

it("opens a clicked friend request at its location and marks it read", async () => {
  const { client, result } = renderActions();

  act(() => result.current.actions.handleNotifClick(friendRequest)());

  expect(result.current.location.pathname).toBe("/member/7");
  expect(result.current.location.state).toEqual({ openFriendRequest: true });
  await waitFor(() => expect(reads).toEqual(["1"]));
  expect(
    client.getQueryData<NotificationDto[]>(queryKeys.notificationsList(20))?.[0]
      ?.readAt,
  ).not.toBeNull();
  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(0);
});

const MarkAll = () => (
  <a href="/elsewhere" onClick={useNotificationActions().handleMarkAllAsRead()}>
    Mark all as read
  </a>
);

it("marks all read without following the link it was clicked on", async () => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <MemoryRouter>
        <MarkAll />
      </MemoryRouter>
    </QueryWrapper>,
  );

  const followed = fireEvent.click(screen.getByText("Mark all as read"));

  expect(followed).toBe(false);
  await waitFor(() => expect(readAlls).toBe(1));
});
