import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import type { MessageDto } from "../client";
import { queryKeys } from "./queryKeys";
import { makeMessage, makeProfile } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useConversationMessages } from "./useConversationMessages";

const message = (id: string, authorId = 2): MessageDto =>
  makeMessage({
    id,
    body: `Message ${id}`,
    author: makeProfile(authorId),
    conversationId: 7,
  });

let loaded: () => Response | Promise<Response>;
let sent: () => Response | Promise<Response>;
let sentBodies: unknown[];
beforeEach(() => {
  loaded = () => Response.json([message("a")]);
  sent = () => Response.json(message("b", 1));
  sentBodies = [];
});

serveApi(
  routes({
    "GET /messaging/messages/:conversationId": () => loaded(),
    "POST /messaging/messages": async ({ request }) => {
      sentBodies.push(await request.json());
      return sent();
    },
  }),
);

const refused = () =>
  Response.json(
    { message: "Message must include text.", statusCode: 400 },
    { status: 400 },
  );

const ids = (messages: MessageDto[] | null) => messages?.map(({ id }) => id);

it("loads the conversation's messages", async () => {
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );

  expect(result.current.messages).toBeNull();
  await waitFor(() => expect(ids(result.current.messages)).toEqual(["a"]));
});

it("shows no messages when they fail to load", async () => {
  loaded = () =>
    Response.json(
      { message: "Internal server error", statusCode: 500 },
      { status: 500 },
    );
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );

  await waitFor(() => expect(result.current.messages).toEqual([]));
});

it("shows a message heard after the messages fail to load", async () => {
  loaded = () =>
    Response.json(
      { message: "Internal server error", statusCode: 500 },
      { status: 500 },
    );
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );
  await waitFor(() => expect(result.current.messages).toEqual([]));

  act(() => {
    result.current.receiveMessage(message("b"));
  });

  await waitFor(() => expect(ids(result.current.messages)).toEqual(["b"]));
});

it("keeps a message heard while the messages load, when the load fails", async () => {
  const load = Promise.withResolvers<Response>();
  loaded = () => load.promise;
  const query = queryWrapper();
  const { result } = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));

  act(() => {
    result.current.receiveMessage(message("b"));
  });
  load.resolve(
    Response.json(
      { message: "Internal server error", statusCode: 500 },
      { status: 500 },
    ),
  );

  await waitFor(() => expect(ids(result.current.messages)).toEqual(["b"]));
});

it("keeps a message heard while the messages load, once", async () => {
  const load = Promise.withResolvers<Response>();
  loaded = () => load.promise;
  const query = queryWrapper();
  const { result } = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));

  act(() => {
    result.current.receiveMessage(message("a"));
    result.current.receiveMessage(message("b"));
  });
  load.resolve(Response.json([message("a")]));

  await waitFor(() => expect(ids(result.current.messages)).toEqual(["a", "b"]));
});

it("puts the viewer's message in place of their oldest unconfirmed one", async () => {
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );
  await waitFor(() => expect(result.current.messages).toHaveLength(1));

  const send = (body: string) =>
    result.current.sendMessage({
      message: { conversationId: 7, body },
      author: makeProfile(1),
    });
  await act(async () => {
    await send("first");
    await send("second");
  });
  act(() => {
    result.current.receiveMessage(message("b", 1));
  });

  await waitFor(() =>
    expect(result.current.messages?.map(({ body }) => body)).toEqual([
      "Message a",
      "second",
      "Message b",
    ]),
  );
});

it("ignores a message it already shows", async () => {
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );
  await waitFor(() => expect(result.current.messages).toHaveLength(1));

  let received = true;
  act(() => {
    received = result.current.receiveMessage(message("a"));
  });

  expect(received).toBe(false);
  expect(ids(result.current.messages)).toEqual(["a"]);
});

it("shows a message heard on one screen on every screen showing the conversation", async () => {
  const query = queryWrapper();
  const first = renderHook(() => useConversationMessages(7), query);
  const second = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(0));

  act(() => {
    first.result.current.receiveMessage(message("b"));
  });

  await waitFor(() =>
    expect(ids(second.result.current.messages)).toEqual(["a", "b"]),
  );
});

it("shows a sent message, replying to a shown one, while it sends", async () => {
  const held = Promise.withResolvers<Response>();
  sent = () => held.promise;
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );
  await waitFor(() => expect(result.current.messages).toHaveLength(1));

  let sending: ReturnType<typeof result.current.sendMessage>;
  act(() => {
    sending = result.current.sendMessage({
      message: { conversationId: 7, body: "Hi", replyToId: "a" },
      author: makeProfile(1),
    });
  });

  await waitFor(() => expect(result.current.messages).toHaveLength(2));
  const [, unconfirmed] = result.current.messages ?? [];
  expect(unconfirmed.id).toStartWith("temp-");
  expect(unconfirmed.body).toBe("Hi");
  expect(unconfirmed.replyTo?.id).toBe("a");
  held.resolve(Response.json(message("b", 1)));
  expect(await sending!).toEqual({ ok: true, value: message("b", 1) });
  expect(sentBodies).toEqual([
    { conversationId: 7, body: "Hi", replyToId: "a" },
  ]);
});

it("takes back a sent message the server refuses, and explains", async () => {
  sent = refused;
  const { result } = renderHook(
    () => useConversationMessages(7),
    queryWrapper(),
  );
  await waitFor(() => expect(result.current.messages).toHaveLength(1));

  let outcome: Awaited<ReturnType<typeof result.current.sendMessage>>;
  await act(async () => {
    outcome = await result.current.sendMessage({
      message: { conversationId: 7, body: "Hi" },
      author: makeProfile(1),
    });
  });

  expect(outcome!).toEqual({
    ok: false,
    error: {
      title: "Couldn't send the message",
      message: "Message must include text.",
    },
  });
  await waitFor(() => expect(ids(result.current.messages)).toEqual(["a"]));
});

it("sends without showing anything when given no author", async () => {
  const query = queryWrapper();
  const shown = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(shown.result.current.messages).toHaveLength(1));
  const sender = renderHook(() => useConversationMessages(null), query);

  await act(async () => {
    await sender.result.current.sendMessage({
      message: { conversationId: 7, body: "Hi" },
    });
  });

  expect(sentBodies).toHaveLength(1);
  expect(ids(shown.result.current.messages)).toEqual(["a"]);
  expect(sender.result.current.messages).toBeNull();
});

it("shows a message sent while the messages load, before and after a load that predates it", async () => {
  const load = Promise.withResolvers<Response>();
  loaded = () => load.promise;
  const query = queryWrapper();
  const { result } = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));

  let sending: ReturnType<typeof result.current.sendMessage>;
  act(() => {
    sending = result.current.sendMessage({
      message: { conversationId: 7, body: "Hi" },
      author: makeProfile(1),
    });
  });
  await sending!;
  await waitFor(() =>
    expect(result.current.messages?.map(({ body }) => body)).toEqual(["Hi"]),
  );
  load.resolve(Response.json([message("a")]));

  await waitFor(() =>
    expect(result.current.messages?.map(({ body }) => body)).toEqual([
      "Message a",
      "Hi",
    ]),
  );
});

it("shows a message sent while the messages load once, when the load already holds it", async () => {
  const load = Promise.withResolvers<Response>();
  loaded = () => load.promise;
  const query = queryWrapper();
  const { result } = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));

  let sending: ReturnType<typeof result.current.sendMessage>;
  act(() => {
    sending = result.current.sendMessage({
      message: { conversationId: 7, body: "Hi" },
      author: makeProfile(1),
    });
  });
  await sending!;
  act(() => {
    result.current.receiveMessage(message("b", 1));
  });
  load.resolve(Response.json([message("a"), message("b", 1)]));

  await waitFor(() => expect(ids(result.current.messages)).toEqual(["a", "b"]));
});

it("takes back a refused message from its conversation after the screen moves on", async () => {
  const held = Promise.withResolvers<Response>();
  sent = () => held.promise;
  const query = queryWrapper();
  const initialProps: { id: number | null } = { id: 7 };
  const shown = renderHook(
    ({ id }: { id: number | null }) => useConversationMessages(id),
    { ...query, initialProps },
  );
  await waitFor(() => expect(shown.result.current.messages).toHaveLength(1));
  let sending: ReturnType<typeof shown.result.current.sendMessage>;
  act(() => {
    sending = shown.result.current.sendMessage({
      message: { conversationId: 7, body: "Hi" },
      author: makeProfile(1),
    });
  });

  shown.rerender({ id: null });
  held.resolve(refused());
  await sending!;

  expect(
    ids(
      query.client.getQueryData<MessageDto[]>(
        queryKeys.conversationMessages(7),
      ) ?? null,
    ),
  ).toEqual(["a"]);
});
