import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  LOADED_AT_QUERY_KEY,
  markAllNotificationsRead,
} from "./notificationsLoadedAt";

const LOADED_AT = "2026-09-23T12:00:00.123Z";

const api = serveApi(routes({}));

const listed = (headers: Record<string, string>) => ({
  "GET /notifs": () => Response.json([], { headers }),
});

it("keeps the list's load time beside the list", async () => {
  api.throwingOnRefusal(listed({ [NOTIFS_LOADED_AT_HEADER]: LOADED_AT }));
  const queryClient = new QueryClient();
  await fetchNotifications(queryClient, new AbortController().signal);
  expect(queryClient.getQueryData(LOADED_AT_QUERY_KEY)).toBe(LOADED_AT);
});

it("keeps no load time when the list came without one", async () => {
  api.throwingOnRefusal(listed({}));
  const queryClient = new QueryClient();
  queryClient.setQueryData(LOADED_AT_QUERY_KEY, LOADED_AT);
  await fetchNotifications(queryClient, new AbortController().signal);
  expect(queryClient.getQueryData(LOADED_AT_QUERY_KEY)).toBeNull();
});

const readAllQueries: URLSearchParams[] = [];

const readAll = {
  "POST /notifs/read-all": ({ request }: { request: Request }) => {
    readAllQueries.push(new URL(request.url).searchParams);
    return new Response(null, { status: 201 });
  },
};

afterEach(() => {
  readAllQueries.length = 0;
});

it("marks all read up to the kept load time", async () => {
  api.throwingOnRefusal(readAll);
  const queryClient = new QueryClient();
  queryClient.setQueryData(LOADED_AT_QUERY_KEY, LOADED_AT);
  await markAllNotificationsRead(queryClient);
  expect(readAllQueries[0]?.get("loadedAt")).toBe(LOADED_AT);
});

it("marks all read with no bound when no load time was kept", async () => {
  api.throwingOnRefusal(readAll);
  await markAllNotificationsRead(new QueryClient());
  expect(readAllQueries[0]?.has("loadedAt")).toBe(false);
});

it("refetches the list and unread count after marking all read", async () => {
  api.throwingOnRefusal(readAll);
  const queryClient = new QueryClient();
  queryClient.setQueryData(["notifications"], []);
  queryClient.setQueryData(["notifications", "unreadCount"], 0);
  await markAllNotificationsRead(queryClient);
  expect(queryClient.getQueryState(["notifications"])?.isInvalidated).toBe(
    true,
  );
  expect(
    queryClient.getQueryState(["notifications", "unreadCount"])?.isInvalidated,
  ).toBe(true);
});
