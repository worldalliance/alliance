import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { Manager, type Socket } from "socket.io-client";
import type { ConversationDto } from "../client";
import { conversationStore, selectConversation } from "./conversationStore";
import { createMessagingHooks } from "./messages";
import * as messagingSocket from "./messagingSocket";
import { queryKeys } from "./queryKeys";
import { endSession } from "./sessionStores";
import { makeConversation, makeMessage, makeParticipant } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityConversation } from "./useCommunityConversation";
import { meCache } from "./useMe";
import { useMyConversations } from "./useMyConversations";

const groupChat: ConversationDto = {
  ...makeConversation([makeParticipant(1, "member")], "community"),
  id: 1,
  title: "Group chat",
  unreadCount: 2,
  hasUnread: true,
};
const direct: ConversationDto = {
  ...makeConversation([makeParticipant(1, "member")], "direct"),
  id: 2,
  title: "Direct",
  createdAt: "2026-09-18T00:00:00.000Z",
};
const read = { ...groupChat, unreadCount: 0, hasUnread: false };

let listed: () => Promise<Response>;
let write: () => Promise<Response>;

serveApi(
  routes({
    "GET /messaging/conversations": () => listed(),
    "GET /messaging/conversations/community/7": async () =>
      Response.json(groupChat),
    "GET /messaging/messages/:conversationId": async () => Response.json([]),
    "POST /messaging/conversations/1/read": () => write(),
    "POST /messaging/conversations/1/update": () => write(),
    "POST /messaging/conversations/2/leave": () => write(),
  }),
);

const { connectMessagingSocket } = messagingSocket;
let sockets: Socket[];
beforeEach(() => {
  listed = async () => Response.json([groupChat, direct]);
  write = async () => Response.json(read);
  sockets = [];
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

const { useConversations, useLiveConvoMessages } = createMessagingHooks({
  getWebSocketUrl: () => "http://messaging.test",
});

const renderSurfaces = () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      list: useMyConversations(),
      group: useCommunityConversation(7),
    }),
    query,
  );
  return { ...query, hook };
};

type Surfaces = ReturnType<typeof renderSurfaces>["hook"];

const loaded = (hook: Surfaces) =>
  waitFor(() => {
    expect(hook.result.current.list.conversations).toHaveLength(2);
    expect(hook.result.current.group.conversation).toBeDefined();
  });

const listedGroupChat = (hook: Surfaces) =>
  hook.result.current.list.conversations?.find(({ id }) => id === 1);

const emit = (event: string, payload: unknown) => {
  for (const socket of sockets)
    for (const listener of socket.listeners(event)) listener(payload);
};

it("shows a group chat read in its panel as read in the Messages list", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  await act(() => hook.result.current.group.markRead(1));

  await waitFor(() => expect(listedGroupChat(hook)).toEqual(read));
});

it("shows a chat read from the Messages list as read in its group's panel", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  await act(() => hook.result.current.list.markRead(1));

  await waitFor(() =>
    expect(hook.result.current.group.conversation).toEqual(read),
  );
});

it("shows a socket's unread update in the group's panel", async () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      list: useConversations(null),
      group: useCommunityConversation(7),
    }),
    query,
  );
  await loaded(hook);

  act(() =>
    emit("conversation:unread", {
      conversation: { ...groupChat, unreadCount: 5 },
    }),
  );

  await waitFor(() =>
    expect(hook.result.current.group.conversation?.unreadCount).toBe(5),
  );
});

it("keeps a newer last message over a read answered after it", async () => {
  const query = queryWrapper();
  const hook = renderHook(() => useConversations(null), query);
  await waitFor(() =>
    expect(hook.result.current.conversations).toHaveLength(2),
  );
  await waitFor(() => expect(sockets).toHaveLength(1));
  const answer = Promise.withResolvers<Response>();
  write = () => answer.promise;
  const newer = makeMessage({
    conversationId: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
  });

  const marked = hook.result.current.markRead(1);
  act(() =>
    emit("conversation:unread", {
      conversation: { ...groupChat, lastMessage: newer, unreadCount: 3 },
    }),
  );
  await waitFor(() =>
    expect(hook.result.current.conversations?.[0].lastMessage).toEqual(newer),
  );
  answer.resolve(Response.json(read));
  await act(() => marked);

  expect(hook.result.current.conversations?.[0]).toEqual({
    ...read,
    lastMessage: newer,
  });
});

it("lists a chat a socket announces while the list is still loading", async () => {
  const held = Promise.withResolvers<Response>();
  listed = () => held.promise;
  const query = queryWrapper();
  const hook = renderHook(() => useConversations(null), query);
  await waitFor(() => expect(sockets).toHaveLength(1));
  const started = {
    ...direct,
    id: 3,
    title: "Started",
    createdAt: "2026-09-19T00:00:00.000Z",
  };

  act(() => emit("conversation:unread", { conversation: started }));
  held.resolve(Response.json([groupChat, direct]));

  await waitFor(() =>
    expect(hook.result.current.conversations?.map(({ id }) => id)).toEqual([
      3, 2, 1,
    ]),
  );
});

it("moves a chat that hears a message in its group's panel to the top of the Messages list", async () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      list: useMyConversations(),
      group: useCommunityConversation(7),
      live: useLiveConvoMessages(1),
    }),
    query,
  );
  await loaded(hook);
  const incoming = makeMessage({
    conversationId: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  write = () => new Promise(() => {});

  act(() => emit("message:new", incoming));

  await waitFor(() =>
    expect(hook.result.current.list.conversations?.[0]).toEqual({
      ...groupChat,
      lastMessage: incoming,
    }),
  );
});

it("keeps a message heard over a list load that read the chat before it", async () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({ list: useMyConversations(), live: useLiveConvoMessages(1) }),
    query,
  );
  await waitFor(() =>
    expect(hook.result.current.list.conversations).toHaveLength(2),
  );
  const held = Promise.withResolvers<Response>();
  listed = () => held.promise;
  write = () => new Promise(() => {});
  const reload = hook.result.current.list.refreshConversations();
  await waitFor(() => expect(query.client.isFetching()).toBe(1));
  const incoming = makeMessage({ conversationId: 1 });

  act(() => emit("message:new", incoming));
  held.resolve(Response.json([groupChat, direct]));
  await act(() => reload);

  expect(
    hook.result.current.list.conversations?.find(({ id }) => id === 1)
      ?.lastMessage,
  ).toEqual(incoming);
});

it("keeps a list load's newer message and title over a read answered while it loads", async () => {
  const query = queryWrapper();
  const hook = renderHook(() => useMyConversations(), query);
  await waitFor(() =>
    expect(hook.result.current.conversations).toHaveLength(2),
  );
  const held = Promise.withResolvers<Response>();
  listed = () => held.promise;
  const reload = hook.result.current.refreshConversations();
  await waitFor(() => expect(query.client.isFetching()).toBe(1));
  const newer = makeMessage({ conversationId: 1 });
  const renamed = { ...groupChat, lastMessage: newer, title: "Renamed" };

  await act(() => hook.result.current.markRead(1));
  held.resolve(Response.json([renamed, direct]));
  await act(() => reload);

  expect(hook.result.current.conversations?.find(({ id }) => id === 1)).toEqual(
    { ...renamed, unreadCount: 0, hasUnread: false },
  );
});

it("keeps a first list load's newer message and title over a read answered while it loads", async () => {
  const held = Promise.withResolvers<Response>();
  listed = () => held.promise;
  const query = queryWrapper();
  const hook = renderHook(() => useMyConversations(), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));
  const newer = makeMessage({ conversationId: 1 });
  const renamed = { ...groupChat, lastMessage: newer, title: "Renamed" };

  await act(() => hook.result.current.markRead(1));
  held.resolve(Response.json([renamed, direct]));

  await waitFor(() =>
    expect(
      hook.result.current.conversations?.find(({ id }) => id === 1),
    ).toEqual({ ...renamed, unreadCount: 0, hasUnread: false }),
  );
});

it("shows a rename in the group's panel", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);
  write = async () => Response.json({ ...groupChat, title: "Renamed" });

  await act(() => hook.result.current.list.updateInfo(1, { title: "Renamed" }));

  await waitFor(() =>
    expect(hook.result.current.group.conversation?.title).toBe("Renamed"),
  );
});

it("keeps a socket update over a list load that read the chat before it", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);
  const held = Promise.withResolvers<Response>();
  listed = () => held.promise;
  const reload = hook.result.current.list.refreshConversations();
  await waitFor(() => expect(client.isFetching()).toBe(1));

  act(() =>
    hook.result.current.list.storeConversation({
      ...groupChat,
      title: "Renamed",
    }),
  );
  held.resolve(Response.json([groupChat, direct]));
  await act(() => reload);

  expect(listedGroupChat(hook)?.title).toBe("Renamed");
});

it("keeps mounted surfaces rendering when the session ends", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);

  act(() => meCache(client).clear());
  hook.rerender();

  expect(hook.result.current.list.conversations).toBeNull();
  expect(hook.result.current.group.conversation).toBeUndefined();
});

it("does not patch the next session with a read answered after a sign-in change", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);
  const answer = Promise.withResolvers<Response>();
  write = () => answer.promise;

  const marked = hook.result.current.list.markRead(1);
  act(() => endSession(client));
  await act(() =>
    conversationStore(client).load({
      signal: new AbortController().signal,
      fetch: async () => ({
        conversations: [{ ...groupChat, title: "Next viewer's copy" }],
        isViewerList: true,
      }),
    }),
  );
  answer.resolve(Response.json(read));
  await act(() => marked);

  expect(
    selectConversation(conversationStore(client).getState(), 1).title,
  ).toBe("Next viewer's copy");
});

it("does not drop a chat from the next session's list when a leave answers after a sign-in change", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);
  const answer = Promise.withResolvers<Response>();
  write = () => answer.promise;

  const left = hook.result.current.list.leave(2);
  act(() => meCache(client).clear());
  hook.rerender();
  await waitFor(() =>
    expect(hook.result.current.list.conversations).toHaveLength(2),
  );
  answer.resolve(Response.json(direct));
  await act(() => left);

  expect(client.getQueryData(queryKeys.myConversations())).toEqual([1, 2]);
});
