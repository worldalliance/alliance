import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { makeNotification } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  actionUpdateNotificationsById,
  newestUpdateId,
  useAllActionUpdates,
  useHomeActionUpdates,
  useRecentActionUpdates,
} from "./useActionUpdates";

let limits: (string | null)[] = [];
let readIds: string[] = [];

const unreadUpdateNotification = makeNotification({
  id: 11,
  contentType: "action_update",
  contentId: 7,
});

serveApi(
  routes({
    "GET /actions/updates": ({ request }) => {
      limits.push(new URL(request.url).searchParams.get("limit"));
      return Response.json([]);
    },
    "GET /actions/allUpdates": () => Response.json([]),
    "GET /notifs": () => Response.json([unreadUpdateNotification]),
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 1 }),
    "POST /notifs/read/:id": ({ params }) => {
      readIds.push(params.id);
      return Response.json({});
    },
  }),
);

it("loads the recent action updates", async () => {
  limits = [];
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useRecentActionUpdates(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([]);
  expect(limits).toEqual(["3"]);
});

it("loads all action updates", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useAllActionUpdates(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([]);
});

it("keys action update notifications by their update and skips other kinds", () => {
  const reply = makeNotification({
    id: 2,
    contentType: "forum_reply",
    contentId: 7,
  });
  const byId = actionUpdateNotificationsById([unreadUpdateNotification, reply]);
  expect([...byId]).toEqual([[7, unreadUpdateNotification]]);
});

it("picks the update with the latest date as the newest", () => {
  expect(
    newestUpdateId([
      { id: 1, date: "2026-01-01T00:00:00.000Z" },
      { id: 2, date: "2026-03-01T00:00:00.000Z" },
      { id: 3, date: "2026-02-01T00:00:00.000Z" },
    ]),
  ).toBe(2);
  expect(newestUpdateId([])).toBeUndefined();
});

it("tags unread updates new and marks one read on open", async () => {
  readIds = [];
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useHomeActionUpdates(), { wrapper });

  await waitFor(() => expect(hook.result.current.isNew(7)).toBe(true));
  expect(hook.result.current.isNew(8)).toBe(false);

  act(() => hook.result.current.markOpened(8));
  act(() => hook.result.current.markOpened(7));
  await waitFor(() => expect(readIds).toEqual(["11"]));
});
