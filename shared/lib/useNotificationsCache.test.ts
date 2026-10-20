import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { NotificationDto } from "@alliance/shared/client";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { routes, serveApi, type RouteTable } from "./testing/serveApi";
import { notificationsCache } from "./useNotificationsCache";

const LOADED_AT = "2026-09-23T12:00:00.123Z";
const SENT = "2026-09-23T12:00:00.000Z";
const LATER = "2026-09-23T12:05:00.000Z";

const LIST_KEY = queryKeys.notificationsList();
const PAGE_KEY = queryKeys.notificationsList(20);
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
  await queryClient.fetchQuery(notificationsCache(queryClient).list());
  expect(queryClient.getQueryData(LOADED_AT_KEY)).toBe(LOADED_AT);
});

it("keeps no load time when the list came without one", async () => {
  api.throwingOnRefusal(listed({}));
  const queryClient = new QueryClient();
  queryClient.setQueryData(LOADED_AT_KEY, LOADED_AT);
  await queryClient.fetchQuery(notificationsCache(queryClient).list());
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

it("marks all read up to the load time of the list it was asked for", async () => {
  api.throwingOnRefusal({
    ...readAll,
    "GET /notifs": ({ request }) =>
      Response.json([], {
        headers: {
          [NOTIFS_LOADED_AT_HEADER]: new URL(request.url).searchParams.has(
            "limit",
          )
            ? LATER
            : LOADED_AT,
        },
      }),
  });
  const queryClient = new QueryClient();
  const cache = notificationsCache(queryClient);
  await queryClient.fetchQuery(cache.list());
  await queryClient.fetchQuery(cache.list(20));
  await cache.markAllRead();
  await cache.markAllRead(20);
  expect(readAllQueries.map((query) => query.get("loadedAt"))).toEqual([
    LOADED_AT,
    LATER,
  ]);
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

it("restores the lists and unread count when marking all read fails", async () => {
  api.alsoServing({
    "POST /notifs/read-all": () => new Response(null, { status: 500 }),
  });
  const queryClient = new QueryClient();
  const list = [notification({ id: 1 }), notification({ id: 2 })];
  queryClient.setQueryData(LIST_KEY, list);
  queryClient.setQueryData(PAGE_KEY, list.slice(0, 1));
  queryClient.setQueryData(UNREAD_COUNT_KEY, 1);
  await notificationsCache(queryClient).markAllRead();
  expect(queryClient.getQueryData(LIST_KEY)).toEqual(list);
  expect(queryClient.getQueryData(PAGE_KEY)).toEqual(list.slice(0, 1));
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

const reads: { id: string; sourceType: string | null }[] = [];

const read = {
  "POST /notifs/read/:id": ({ params, request }) => {
    reads.push({
      id: params.id,
      sourceType: new URL(request.url).searchParams.get("sourceType"),
    });
    return new Response(null, { status: 201 });
  },
} satisfies RouteTable;

afterEach(() => {
  reads.length = 0;
});

it("sends a read for each notification with its source type", async () => {
  api.throwingOnRefusal(read);
  await notificationsCache(new QueryClient()).markRead([
    { id: 1, sourceType: "unread_content" },
    { id: 2, sourceType: "notification" },
  ]);
  expect(reads).toEqual([
    { id: "1", sourceType: "unread_content" },
    { id: "2", sourceType: "notification" },
  ]);
});

it("refetches the list and unread count and rejects when a read is refused", async () => {
  api.alsoServing({
    "POST /notifs/read/:id": () => new Response(null, { status: 500 }),
  });
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1 }),
  ]);
  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 1);

  await expect(
    notificationsCache(queryClient).markRead([
      { id: 1, sourceType: "unread_content" },
    ]),
  ).rejects.toThrow();

  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("refetches after every read has finished when one is refused", async () => {
  const { promise: slowReadHeld, resolve: releaseSlowRead } =
    Promise.withResolvers<void>();
  const { promise: refusedReadAnswered, resolve: answerRefusedRead } =
    Promise.withResolvers<void>();
  api.throwingOnRefusal({
    "POST /notifs/read/:id": async ({ params }) => {
      if (params.id === "1") {
        answerRefusedRead();
        return new Response(null, { status: 500 });
      }
      await slowReadHeld;
      return new Response(null, { status: 201 });
    },
  });
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1 }),
    notification({ id: 2 }),
  ]);

  const marked = notificationsCache(queryClient).markRead([
    { id: 1, sourceType: "unread_content" },
    { id: 2, sourceType: "unread_content" },
  ]);
  await refusedReadAnswered;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);

  releaseSlowRead();
  await expect(marked).rejects.toThrow();
  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
});

it("marks the given notifications read and counts down only those that were unread", async () => {
  api.throwingOnRefusal(read);
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1 }),
    notification({ id: 2, readAt: SENT }),
    notification({ id: 3 }),
    notification({ id: 1, sourceType: "notification" }),
  ]);
  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 5);

  await notificationsCache(queryClient).markRead([
    { id: 1, sourceType: "unread_content" },
    { id: 2, sourceType: "unread_content" },
  ]);

  const cached = queryClient.getQueryData<NotificationDto[]>(LIST_KEY);
  expect(cached?.map((n) => n.readAt !== null)).toEqual([
    true,
    true,
    false,
    false,
  ]);
  expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(4);
});

it("leaves an uncached unread count uncached", async () => {
  api.throwingOnRefusal(read);
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1 }),
    notification({ id: 2 }),
  ]);

  await notificationsCache(queryClient).markRead([
    { id: 1, sourceType: "unread_content" },
  ]);

  expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBeUndefined();
});

it("marks a notification read in every cached list and counts it down once", async () => {
  api.throwingOnRefusal(read);
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1 }),
    notification({ id: 2 }),
  ]);
  queryClient.setQueryData<NotificationDto[]>(PAGE_KEY, [
    notification({ id: 1 }),
  ]);
  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 2);

  await notificationsCache(queryClient).markRead([
    { id: 1, sourceType: "unread_content" },
  ]);

  for (const key of [LIST_KEY, PAGE_KEY]) {
    expect(
      queryClient.getQueryData<NotificationDto[]>(key)?.[0]?.readAt,
    ).not.toBeNull();
  }
  expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(1);
});

it("loads only the asked-for number of notifications", async () => {
  const limits: (string | null)[] = [];
  api.throwingOnRefusal({
    "GET /notifs": ({ request }) => {
      limits.push(new URL(request.url).searchParams.get("limit"));
      return Response.json([]);
    },
  });
  const queryClient = new QueryClient();
  await queryClient.fetchQuery(notificationsCache(queryClient).list(20));
  await queryClient.fetchQuery(notificationsCache(queryClient).list());
  expect(limits).toEqual(["20", null]);
});

it("refetches the list and unread count when the list is not cached", async () => {
  api.throwingOnRefusal(read);
  const queryClient = new QueryClient();
  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 3);

  await notificationsCache(queryClient).markRead([
    { id: 1, sourceType: "unread_content" },
  ]);

  expect(queryClient.getQueryData(LIST_KEY)).toBeUndefined();
  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("refetches the list and unread count when the notification is not in the list", async () => {
  api.throwingOnRefusal(read);
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, [
    notification({ id: 1 }),
  ]);
  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 1);

  await notificationsCache(queryClient).markRead([
    { id: 9, sourceType: "unread_content" },
  ]);

  expect(queryClient.getQueryData(UNREAD_COUNT_KEY)).toBe(1);
  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(UNREAD_COUNT_KEY)?.isInvalidated).toBe(true);
});

it("leaves the cache alone when marking nothing", async () => {
  api.throwingOnRefusal(read);
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(LIST_KEY, []);

  await notificationsCache(queryClient).markRead([]);

  expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);
});
