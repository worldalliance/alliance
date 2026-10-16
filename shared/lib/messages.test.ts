import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { Manager, type Socket } from "socket.io-client";
import type { ConversationDto } from "../client";
import { createMessagingHooks } from "./messages";
import * as messagingSocket from "./messagingSocket";
import { makeConversation, makeParticipant } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMyConversations } from "./useMyConversations";

const group: ConversationDto = {
  ...makeConversation([makeParticipant(1, "admin")]),
  id: 7,
};

let listed: ConversationDto[];
let heldList: Promise<Response> | null;
let fetches: number;
serveApi(
  routes({
    "GET /messaging/conversations": () => {
      fetches++;
      return heldList ?? Response.json(listed);
    },
  }),
);

const { connectMessagingSocket } = messagingSocket;
let overviewSockets: Socket[];
beforeEach(() => {
  overviewSockets = [];
  heldList = null;
  listed = [group];
  fetches = 0;
  spyOn(Manager.prototype, "open").mockImplementation(function (this: Manager) {
    return this;
  });
  spyOn(messagingSocket, "connectMessagingSocket").mockImplementation(
    (namespace, config) => {
      const connected = connectMessagingSocket(namespace, config);
      overviewSockets.push(connected.socket);
      return connected;
    },
  );
});

afterEach(() => {
  cleanup();
  mock.restore();
});

const { useConversations } = createMessagingHooks({
  getWebSocketUrl: () => "http://messaging.test",
});

const unread = (socket: Socket, unreadCount: number) => {
  for (const listener of socket.listeners("conversation:unread"))
    listener({ conversationId: group.id, unreadCount });
};

it("shows an unread update from the socket to every reader of the list", async () => {
  const query = queryWrapper();
  renderHook(() => useConversations(null), query);
  const reader = renderHook(useMyConversations, query);
  await waitFor(() =>
    expect(reader.result.current.conversations).toHaveLength(1),
  );

  act(() => unread(overviewSockets[0], 3));

  await waitFor(() =>
    expect(reader.result.current.conversations?.[0].unreadCount).toBe(3),
  );
});

it("keeps a conversation open on one screen read, whichever screen's socket hears the update last", async () => {
  const query = queryWrapper();
  renderHook(() => useConversations(group.id), query);
  const list = renderHook(() => useConversations(null), query);
  await waitFor(() =>
    expect(list.result.current.conversations).toHaveLength(1),
  );

  act(() => {
    unread(overviewSockets[0], 3);
    unread(overviewSockets[1], 3);
  });

  await waitFor(() => expect(query.client.isFetching()).toBe(0));
  expect(list.result.current.conversations?.[0].unreadCount).toBe(0);
});

it("keeps a socket update over a reload that another screen started before it", async () => {
  const query = queryWrapper();
  const list = renderHook(() => useConversations(null), query);
  await waitFor(() =>
    expect(list.result.current.conversations).toHaveLength(1),
  );
  const staleReload = Promise.withResolvers<Response>();
  heldList = staleReload.promise;
  renderHook(() => useConversations(99), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));
  heldList = null;

  act(() => unread(overviewSockets[0], 3));
  staleReload.resolve(Response.json([group]));

  await waitFor(() => expect(query.client.isFetching()).toBe(0));
  expect(list.result.current.conversations?.[0].unreadCount).toBe(3);
});

it("lets a reload land however many socket updates arrive while it runs", async () => {
  const query = queryWrapper();
  const list = renderHook(() => useConversations(null), query);
  await waitFor(() =>
    expect(list.result.current.conversations).toHaveLength(1),
  );
  const reload = Promise.withResolvers<Response>();
  heldList = reload.promise;
  renderHook(() => useConversations(99), query);
  await waitFor(() => expect(fetches).toBe(2));

  act(() => {
    for (const count of [1, 2, 3])
      for (const socket of overviewSockets) unread(socket, count);
  });
  reload.resolve(Response.json([group]));

  await waitFor(() => expect(list.result.current.loading).toBe(false));
  expect(fetches).toBe(2);
  expect(list.result.current.conversations?.[0].unreadCount).toBe(3);
});
