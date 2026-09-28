import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { NotificationDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient } from "@tanstack/react-query";
import { notificationsCache } from "./useNotificationsCache";

const LOADED_AT = "2026-09-23T12:00:00.123Z";
const SENT = "2026-09-23T12:00:00.000Z";

const LIST_KEY = queryKeys.notifications();
const LOADED_AT_KEY = queryKeys.notificationsLoadedAt();
const UNREAD_COUNT_KEY = queryKeys.notificationsUnreadCount();

const api = serveApi(routes({}));

const notification = (
  overrides: Pick<NotificationDto, "id"> & Partial<NotificationDto>,
): NotificationDto => ({
  category: "forum_reply",
  message: "A reply",
  priority: "low",
  webAppLocation: "/",
  mobileAppLocation: null,
  readAt: null,
  createdAt: SENT,
  updatedAt: SENT,
  sendTime: SENT,
  associatedUsers: [],
  sourceType: "unread_content",
  contentType: "forum_reply",
  ...overrides,
});

const listed = (headers: Record<string, string>) => ({
  "GET /notifs": () => Response.json([], { headers }),
});

it("keeps the list's load time beside the list", async () => {
  api.throwingOnRefusal(listed({ [NOTIFS_LOADED_AT_HEADER]: LOADED_AT }));
  const queryClient = new QueryClient();
  await queryClient.fetchQuery(notificationsCache(queryClient).list);
  expect(queryClient.getQueryData(LOADED_AT_KEY)).toBe(LOADED_AT);
});

it("keeps no load time when the list came without one", async () => {
  api.throwingOnRefusal(listed({}));
  const queryClient = new QueryClient();
  queryClient.setQueryData(LOADED_AT_KEY, LOADED_AT);
  await queryClient.fetchQuery(notificationsCache(queryClient).list);
  expect(queryClient.getQueryData(LOADED_AT_KEY)).toBeNull();
});

it("loads the unread count", async () => {
  api.throwingOnRefusal({
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 4 }),
  });
  const queryClient = new QueryClient();
  expect(
    await queryClient.fetchQuery(notificationsCache(queryClient).unreadCount),
  ).toBe(4);
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

it("refetches the list and unread count on refresh", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(LIST_KEY, []);
  queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
  await notificationsCache(queryClient).refresh();
  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("marks all read up to the kept load time", async () => {
  api.throwingOnRefusal(readAll);
  const queryClient = new QueryClient();
  queryClient.setQueryData(LOADED_AT_KEY, LOADED_AT);
  await notificationsCache(queryClient).markAllRead();
  expect(readAllQueries[0]?.get("loadedAt")).toBe(LOADED_AT);
});

it("marks all read with no bound when no load time was kept", async () => {
  api.throwingOnRefusal(readAll);
  await notificationsCache(new QueryClient()).markAllRead();
  expect(readAllQueries[0]?.has("loadedAt")).toBe(false);
});

it("marks the cached list read and refetches it and the unread count", async () => {
  api.throwingOnRefusal(readAll);
  const queryClient = new QueryClient();
  queryClient.setQueryData(LIST_KEY, [notification({ id: 1 })]);
  queryClient.setQueryData(UNREAD_COUNT_KEY, 1);
  await notificationsCache(queryClient).markAllRead();
  expect(
    queryClient.getQueryData<NotificationDto[]>(LIST_KEY)?.[0]?.readAt,
  ).not.toBeNull();
  expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(0);
  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("restores the list and unread count when marking all read fails", async () => {
  api.throwingOnRefusal({
    "POST /notifs/read-all": () => new Response(null, { status: 500 }),
  });
  const queryClient = new QueryClient();
  const list = [notification({ id: 1 })];
  queryClient.setQueryData(LIST_KEY, list);
  queryClient.setQueryData(UNREAD_COUNT_KEY, 1);
  await notificationsCache(queryClient).markAllRead();
  expect(queryClient.getQueryData(LIST_KEY)).toEqual(list);
  expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(1);
});

it("refetches the unread count it had not cached when marking all read fails", async () => {
  api.throwingOnRefusal({
    "POST /notifs/read-all": () => new Response(null, { status: 500 }),
  });
  const queryClient = new QueryClient();
  queryClient.setQueryData(LIST_KEY, [notification({ id: 1 })]);
  await notificationsCache(queryClient).markAllRead();
  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("marks the cached notifications for the read content, and only those", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1, contentId: 10 }),
    notification({ id: 2, contentId: 11 }),
    notification({ id: 3, contentId: 10, contentType: "action_update" }),
  ]);

  notificationsCache(queryClient).markCachedReadByContent("forum_reply", [10]);

  const cached = queryClient.getQueryData<NotificationDto[]>(LIST_KEY);
  expect(cached?.map((n) => n.readAt !== null)).toEqual([true, false, false]);
});

it("refetches the unread count after marking content read", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 3);

  notificationsCache(queryClient).markCachedReadByContent("forum_reply", [10]);

  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("leaves an unloaded list unloaded when marking content read", () => {
  const queryClient = new QueryClient();
  notificationsCache(queryClient).markCachedReadByContent("forum_reply", [10]);
  expect(queryClient.getQueryData(LIST_KEY)).toBeUndefined();
});
