import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { Manager, type Socket } from "socket.io-client";
import * as messagingSocket from "./messagingSocket";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useUnreadMessageCount } from "./useUnreadMessageCount";

let totalCount: number;
let fetches: number;
let summaryFails: boolean;
serveApi(
  routes({
    "GET /messaging/conversations/unread-summary": () => {
      fetches++;
      if (summaryFails) {
        return Response.json(
          { message: "Internal server error", statusCode: 500 },
          { status: 500 },
        );
      }
      return Response.json({
        messageCount: totalCount,
        messageRequestCount: 0,
        totalCount,
      });
    },
  }),
);

const { connectMessagingSocket } = messagingSocket;
let sockets: Socket[];
beforeEach(() => {
  sockets = [];
  totalCount = 2;
  fetches = 0;
  summaryFails = false;
  spyOn(Manager.prototype, "open").mockImplementation(function (this: Manager) {
    return this;
  });
  spyOn(messagingSocket, "connectMessagingSocket").mockImplementation(
    (namespace, config) => {
      const connected = connectMessagingSocket(namespace, config);
      sockets.push(connected.socket);
      return connected;
    },
  );
});

afterEach(() => {
  cleanup();
  mock.restore();
});

const config = { getWebSocketUrl: () => "http://messaging.test" };

it("refetches the count for every reader when the socket announces an unread change", async () => {
  const query = queryWrapper();
  const first = renderHook(() => useUnreadMessageCount(config), query);
  const second = renderHook(() => useUnreadMessageCount(config), query);
  await waitFor(() => expect(first.result.current).toBe(2));

  totalCount = 5;
  act(() => {
    for (const listener of sockets[0].listeners("conversation:unread"))
      listener({ conversationId: 1, unreadCount: 5 });
  });

  await waitFor(() => expect(second.result.current).toBe(5));
  expect(first.result.current).toBe(5);
  expect(fetches).toBe(2);
});

it("closes its socket on unmount", async () => {
  const hook = renderHook(() => useUnreadMessageCount(config), queryWrapper());
  await waitFor(() => expect(hook.result.current).toBe(2));
  expect(sockets[0].active).toBe(true);

  hook.unmount();

  expect(sockets[0].active).toBe(false);
});

it("logs a failed load and shows no unread messages", async () => {
  summaryFails = true;
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const query = queryWrapper();
  const hook = renderHook(() => useUnreadMessageCount(config), query);

  await waitFor(() =>
    expect(
      query.client.getQueryState(queryKeys.conversationUnreadSummary())?.status,
    ).toBe("error"),
  );
  expect(hook.result.current).toBe(0);
  expect(logged).toHaveBeenCalledWith(
    "Failed to load unread messages count",
    expect.anything(),
  );
});
