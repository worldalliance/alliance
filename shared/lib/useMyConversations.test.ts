import { act, renderHook, waitFor } from "@testing-library/react";
import { milliseconds } from "date-fns";
import type { ConversationDto } from "../client";
import { queryKeys } from "./queryKeys";
import { makeConversation, makeParticipant } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMyConversations } from "./useMyConversations";

const conversation = (
  id: number,
  createdAt: string,
  title = `Group ${id}`,
): ConversationDto => ({
  ...makeConversation([makeParticipant(1, "admin")]),
  id,
  createdAt,
  title,
});

const older = conversation(1, "2026-09-01T00:00:00.000Z");
const newer = conversation(2, "2026-09-02T00:00:00.000Z");

let listed: ConversationDto[];
let fetches: number;
let heldList: Promise<Response> | null;
let listFails: boolean;
let started: () => Response;
let accepted: () => Response;
beforeEach(() => {
  started = () => Response.json(conversation(3, "2026-09-03T00:00:00.000Z"));
  accepted = () => Response.json(older);
  listed = [older, newer];
  fetches = 0;
  heldList = null;
  listFails = false;
});

serveApi(
  routes({
    "GET /messaging/conversations": () => {
      fetches++;
      if (listFails) {
        return Response.json(
          { message: "Internal server error", statusCode: 500 },
          { status: 500 },
        );
      }
      return heldList ?? Response.json(listed);
    },
    "POST /messaging/conversations/:conversationId/update": () =>
      Response.json(
        { message: "Only admins can rename the group.", statusCode: 403 },
        { status: 403 },
      ),
    "POST /messaging/conversations/:conversationId/leave": () =>
      Response.json(older),
    "POST /messaging/conversations/direct": () => started(),
    "POST /messaging/conversations/group": () => started(),
    "POST /messaging/conversations/:conversationId/accept": () => accepted(),
  }),
);

it("lists the viewer's conversations newest first", async () => {
  const { result } = renderHook(useMyConversations, queryWrapper());

  await waitFor(() =>
    expect(result.current.conversations?.map(({ id }) => id)).toEqual([2, 1]),
  );
});

it("shows a write from one screen on every screen holding the list", async () => {
  const query = queryWrapper();
  const first = renderHook(useMyConversations, query);
  const second = renderHook(useMyConversations, query);
  await waitFor(() => expect(query.client.isFetching()).toBe(0));

  act(() =>
    first.result.current.setConversations(
      (prev) => prev?.map((c) => ({ ...c, title: "Renamed" })) ?? null,
    ),
  );

  await waitFor(() =>
    expect(
      second.result.current.conversations?.map(({ title }) => title),
    ).toEqual(["Renamed", "Renamed"]),
  );
});

it("reloads the list when a screen opens, even while the cached copy is fresh", async () => {
  const query = queryWrapper({ staleTime: milliseconds({ minutes: 5 }) });
  const first = renderHook(useMyConversations, query);
  await waitFor(() =>
    expect(first.result.current.conversations).toHaveLength(2),
  );
  listed = [older];

  const second = renderHook(useMyConversations, query);

  await waitFor(() =>
    expect(second.result.current.conversations).toHaveLength(1),
  );
  expect(fetches).toBe(2);
});

it("reports loading while a screen reloads a cached list that lacks its conversation", async () => {
  const query = queryWrapper();
  const first = renderHook(useMyConversations, query);
  await waitFor(() =>
    expect(first.result.current.conversations).toHaveLength(2),
  );
  first.unmount();
  const reload = Promise.withResolvers<Response>();
  heldList = reload.promise;

  const second = renderHook(useMyConversations, query);

  expect(second.result.current.loading).toBe(true);
  reload.resolve(
    Response.json([...listed, conversation(3, "2026-09-03T00:00:00.000Z")]),
  );
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.conversations).toHaveLength(3);
});

it("keeps the cached list and reports the failure when a reload fails", async () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.myConversations(), [older]);
  listFails = true;

  const { result } = renderHook(useMyConversations, query);

  await waitFor(() => expect(result.current.reloadFailed).toBe(true));
  expect(result.current.conversations).toEqual([older]);
});

it("keeps reporting a failed reload through later writes, until a reload works", async () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.myConversations(), [older]);
  listFails = true;
  const { result } = renderHook(useMyConversations, query);
  await waitFor(() => expect(result.current.reloadFailed).toBe(true));

  act(() =>
    result.current.setConversations(
      (prev) => prev?.map((c) => ({ ...c, unreadCount: 5 })) ?? null,
    ),
  );
  await waitFor(() =>
    expect(result.current.conversations?.[0].unreadCount).toBe(5),
  );
  expect(result.current.reloadFailed).toBe(true);

  listFails = false;
  await act(() => result.current.refreshConversations());

  await waitFor(() => expect(result.current.reloadFailed).toBe(false));
});

it("keeps the list as it was and says why when the server refuses a write", async () => {
  const { result } = renderHook(useMyConversations, queryWrapper());
  await waitFor(() => expect(result.current.conversations).toHaveLength(2));

  const saved = await act(() =>
    result.current.updateInfo(older.id, { title: "Renamed" }),
  );

  expect(saved).toEqual({
    ok: false,
    error: {
      title: "Couldn't save the group",
      message: "Only admins can rename the group.",
    },
  });
  expect(result.current.conversations).toEqual([newer, older]);
});

it("keeps a write over a reload that read the list before it", async () => {
  const query = queryWrapper();
  const page = renderHook(useMyConversations, query);
  await waitFor(() =>
    expect(page.result.current.conversations).toHaveLength(2),
  );
  const staleReload = Promise.withResolvers<Response>();
  heldList = staleReload.promise;
  const panel = renderHook(useMyConversations, query);
  await waitFor(() => expect(fetches).toBe(2));
  heldList = null;
  listed = [newer];

  await act(() => panel.result.current.leave(older.id));
  staleReload.resolve(Response.json([older, newer]));

  await waitFor(() => expect(query.client.isFetching()).toBe(0));
  expect(page.result.current.conversations).toEqual([newer]);
});

it("lists a chat the viewer starts in order", async () => {
  const { result } = renderHook(useMyConversations, queryWrapper());
  await waitFor(() => expect(result.current.conversations).toHaveLength(2));

  await act(() => result.current.createDirectConversation(5));

  await waitFor(() =>
    expect(result.current.conversations?.map(({ id }) => id)).toEqual([
      3, 2, 1,
    ]),
  );
});

it("lists a started chat the list already holds once, as the server returns it", async () => {
  const { result } = renderHook(useMyConversations, queryWrapper());
  await waitFor(() => expect(result.current.conversations).toHaveLength(2));
  const renamed = { ...older, title: "Renamed" };
  started = () => Response.json(renamed);

  await act(() =>
    result.current.createGroupConversation({
      participantIds: [5, 6],
      title: "Renamed",
    }),
  );

  await waitFor(() =>
    expect(result.current.conversations).toEqual([newer, renamed]),
  );
});

it("keeps the list as it was and says why when the server refuses to start a chat", async () => {
  const { result } = renderHook(useMyConversations, queryWrapper());
  await waitFor(() => expect(result.current.conversations).toHaveLength(2));
  started = () =>
    Response.json(
      { message: "You can't message that user.", statusCode: 403 },
      { status: 403 },
    );

  const created = await act(() => result.current.createDirectConversation(5));

  expect(created).toEqual({
    ok: false,
    error: {
      title: "Couldn't start the chat",
      message: "You can't message that user.",
    },
  });
  expect(result.current.conversations).toEqual([newer, older]);
});

it("lists an accepted request as the server returns it", async () => {
  listed = [
    {
      ...older,
      participants: [{ ...older.participants[0], state: "invited" }],
    },
  ];
  const { result } = renderHook(useMyConversations, queryWrapper());
  await waitFor(() => expect(result.current.conversations).toHaveLength(1));

  await act(() => result.current.acceptInvite(older.id));

  await waitFor(() => expect(result.current.conversations).toEqual([older]));
});
