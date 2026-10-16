import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "bun:test";
import type { MessageDto } from "../client";
import { queryKeys } from "./queryKeys";
import { makeMessage, makeProfile } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useConversationMessages } from "./useConversationMessages";

afterEach(cleanup);

const message = (id: string, authorId = 2): MessageDto =>
  makeMessage({
    id,
    body: `Message ${id}`,
    author: makeProfile(authorId),
    conversationId: 7,
  });

let loaded: () => Response | Promise<Response>;
beforeEach(() => {
  loaded = () => Response.json([message("a")]);
});

serveApi(
  routes({
    "GET /messaging/messages/:conversationId": () => loaded(),
  }),
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

  act(() => {
    result.current.addOptimisticMessage(message("temp-1", 1));
    result.current.addOptimisticMessage(message("temp-2", 1));
    result.current.receiveMessage(message("b", 1));
  });

  await waitFor(() =>
    expect(ids(result.current.messages)).toEqual(["a", "temp-2", "b"]),
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

it("shows an unconfirmed message added before the messages load", async () => {
  const load = Promise.withResolvers<Response>();
  loaded = () => load.promise;
  const query = queryWrapper();
  const { result } = renderHook(() => useConversationMessages(7), query);
  await waitFor(() => expect(query.client.isFetching()).toBe(1));

  act(() => {
    result.current.addOptimisticMessage(message("temp-1", 1));
  });

  await waitFor(() => expect(ids(result.current.messages)).toEqual(["temp-1"]));
  load.resolve(Response.json([message("a")]));
  await waitFor(() => expect(ids(result.current.messages)).toEqual(["a"]));
});

it("takes back an unconfirmed message from its conversation after the screen moves on", async () => {
  const query = queryWrapper();
  const initialProps: { id: number | null } = { id: 7 };
  const shown = renderHook(
    ({ id }: { id: number | null }) => useConversationMessages(id),
    { ...query, initialProps },
  );
  await waitFor(() => expect(shown.result.current.messages).toHaveLength(1));
  act(() => {
    shown.result.current.addOptimisticMessage(message("temp-1", 1));
  });

  shown.rerender({ id: null });
  act(() => {
    shown.result.current.removeOptimisticMessage("temp-1");
  });

  expect(
    ids(
      query.client.getQueryData<MessageDto[]>(
        queryKeys.conversationMessages(7),
      ) ?? null,
    ),
  ).toEqual(["a"]);
});
