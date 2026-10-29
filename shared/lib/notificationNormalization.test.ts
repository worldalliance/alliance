import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { NotificationDto } from "../client";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { notificationStore } from "./notificationStore";
import { queryKeys } from "./queryKeys";
import { currentSession, endSession } from "./sessionStores";
import { makeNotification } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { seedNotifications } from "./testing/seedNotifications";
import { routes, serveApi } from "./testing/serveApi";
import { meCache } from "./useMe";
import {
  notificationsCache,
  useNotificationsList,
} from "./useNotificationsCache";

const LOADED_AT = "2026-09-23T12:00:00.000Z";

let listed: () => Response | Promise<Response>;
let counted: () => Response | Promise<Response>;
let readResponse: () => Response | Promise<Response>;
let readAllResponse: () => Response | Promise<Response>;

serveApi(
  routes({
    "GET /notifs": () => listed(),
    "GET /notifs/unread-count": () => counted(),
    "POST /notifs/read/:id": () => readResponse(),
    "POST /notifs/read-all": () => readAllResponse(),
  }),
);

const list = (notifications: NotificationDto[]) =>
  Response.json(notifications, {
    headers: { [NOTIFS_LOADED_AT_HEADER]: LOADED_AT },
  });
const accepted = () => new Response(null, { status: 201 });

beforeEach(() => {
  listed = () => list([makeNotification({ id: 1 })]);
  counted = () => Response.json({ unreadCount: 1 });
  readResponse = accepted;
  readAllResponse = accepted;
});

const held = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  return {
    release: resolve,
    until: <T>(value: T) => promise.then(() => value),
  };
};

const readStates = (notifications: NotificationDto[] | undefined) =>
  notifications?.map((notification) => notification.readAt !== null);

it("shows a list response in a list loaded earlier", async () => {
  const { wrapper } = queryWrapper();
  const bell = renderHook(() => useNotificationsList(20), { wrapper });
  await waitFor(() => expect(bell.result.current.data).toHaveLength(1));

  listed = () => list([makeNotification({ id: 1, message: "Edited" })]);
  const page = renderHook(() => useNotificationsList(), { wrapper });

  await waitFor(() =>
    expect(bell.result.current.data?.[0]?.message).toBe("Edited"),
  );
  expect(page.result.current.data).toEqual(bell.result.current.data);
});

it("keeps a newer list response over an older one that lands later", async () => {
  const { client } = queryWrapper();
  const cache = notificationsCache(client);
  const older = held();
  listed = () =>
    older.until(list([makeNotification({ id: 1, message: "Older" })]));
  const loadingOlder = client.fetchQuery(cache.list());
  listed = () => list([makeNotification({ id: 1, message: "Newer" })]);
  await client.fetchQuery(cache.list(20));
  older.release();
  await loadingOlder;

  expect(
    notificationStore(client).get(
      getNotificationIdentityKey(makeNotification({ id: 1 })),
    )?.message,
  ).toBe("Newer");
});

it("keeps a read made while a list loads", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const response = held();
  listed = () => response.until(list([makeNotification({ id: 1 })]));
  const page = renderHook(() => useNotificationsList(), { wrapper });
  void client.invalidateQueries({ queryKey: queryKeys.notificationsLists() });

  await act(() =>
    notificationsCache(client).markRead([makeNotification({ id: 1 })]),
  );
  response.release();

  await waitFor(() => expect(page.result.current.isFetching).toBe(false));
  expect(readStates(page.result.current.data)).toEqual([true]);
});

it("keeps a read in every list when one list loads before the server confirms it", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 })],
    limit: 20,
  });
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const confirmation = held();
  readResponse = () => confirmation.until(accepted());
  const page = renderHook(() => useNotificationsList(), { wrapper });

  const cache = notificationsCache(client);

  const marked = cache.markRead([makeNotification({ id: 1 })]);
  await act(() => client.fetchQuery({ ...cache.list(20), staleTime: 0 }));

  expect(readStates(page.result.current.data)).toEqual([true]);
  confirmation.release();
  await act(() => marked);
});

it("drops a refused read from a list load that started before the refusal", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const refusal = held();
  readResponse = () => refusal.until(new Response(null, { status: 500 }));
  const cache = notificationsCache(client);

  const marked = cache.markRead([makeNotification({ id: 1 })]).catch(() => {});
  const response = held();
  listed = () => response.until(list([makeNotification({ id: 1 })]));
  const loading = client.fetchQuery({ ...cache.list(), staleTime: 0 });
  refusal.release();
  await marked;
  response.release();
  await loading;

  expect(
    notificationStore(client).get(
      getNotificationIdentityKey(makeNotification({ id: 1 })),
    )?.readAt,
  ).toBeNull();
});

it("keeps mark-all-read in a list load that starts before the server confirms it", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const confirmation = held();
  readAllResponse = () => confirmation.until(accepted());
  const cache = notificationsCache(client);

  const markedAll = cache.markAllRead();
  await waitFor(() =>
    expect(
      notificationStore(client).get(
        getNotificationIdentityKey(makeNotification({ id: 1 })),
      )?.readAt,
    ).not.toBeNull(),
  );
  const loaded = await client.fetchQuery({ ...cache.list(), staleTime: 0 });

  expect(
    loaded.keys.map((key) => notificationStore(client).get(key)?.readAt),
  ).not.toContain(null);
  confirmation.release();
  await markedAll;
});

it("shows a list load's content for a record read while it loaded", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1, message: "Old" })],
  });
  const response = held();
  listed = () =>
    response.until(list([makeNotification({ id: 1, message: "Edited" })]));
  const page = renderHook(() => useNotificationsList(), { wrapper });
  void client.invalidateQueries({ queryKey: queryKeys.notificationsLists() });

  await act(() =>
    notificationsCache(client).markRead([makeNotification({ id: 1 })]),
  );
  response.release();

  await waitFor(() => expect(page.result.current.isFetching).toBe(false));
  expect(page.result.current.data?.[0]?.message).toBe("Edited");
  expect(readStates(page.result.current.data)).toEqual([true]);
});

it("refetches for a read of a record no cached list holds", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  client.removeQueries({ queryKey: queryKeys.notificationsLists() });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 3);

  await notificationsCache(client).markRead([makeNotification({ id: 1 })]);

  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(3);
  expect(
    client.getQueryState(queryKeys.notificationsUnreadCount())?.isInvalidated,
  ).toBe(true);
});

it("ignores a write from an ended session", () => {
  const { client } = queryWrapper();
  const session = currentSession(client);
  endSession(client);
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 1);

  const store = notificationStore(client);
  store.write({
    session,
    change: (notification) => ({ ...notification, readAt: LOADED_AT }),
  });
  store.writeUnreadCount({ session, update: () => 0 });

  expect(
    store.get(getNotificationIdentityKey(makeNotification({ id: 1 })))?.readAt,
  ).toBeNull();
  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(1);
});

it("drops a failed mark-all-read's restore after the session ends", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const confirmation = held();
  readAllResponse = () =>
    confirmation.until(new Response(null, { status: 500 }));

  const markedAll = notificationsCache(client).markAllRead();
  await waitFor(() =>
    expect(
      notificationStore(client).get(
        getNotificationIdentityKey(makeNotification({ id: 1 })),
      )?.readAt,
    ).not.toBeNull(),
  );
  meCache(client).clear();
  confirmation.release();
  await markedAll;

  expect(
    notificationStore(client).get(
      getNotificationIdentityKey(makeNotification({ id: 1 })),
    ),
  ).toBeUndefined();
  expect(client.getQueryData(queryKeys.notificationsList())).toBeUndefined();
});

it("sends no mark-all-read when the session ends while it cancels loads", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  let readAlls = 0;
  readAllResponse = () => {
    readAlls++;
    return accepted();
  };

  const markedAll = notificationsCache(client).markAllRead();
  meCache(client).clear();
  await markedAll;

  expect(readAlls).toBe(0);
});

it("leaves a new session's lists alone when an old session's read is refused", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const refusal = held();
  readResponse = () => refusal.until(new Response(null, { status: 500 }));

  const marked = notificationsCache(client)
    .markRead([makeNotification({ id: 1 })])
    .catch(() => {});
  endSession(client);
  seedNotifications({ client, notifications: [makeNotification({ id: 2 })] });
  refusal.release();
  await marked;

  expect(
    client.getQueryState(queryKeys.notificationsList())?.isInvalidated,
  ).toBe(false);
});

it("leaves a new session's lists alone when an old session's mark-all-read succeeds", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const confirmation = held();
  readAllResponse = () => confirmation.until(accepted());

  const markedAll = notificationsCache(client).markAllRead();
  await waitFor(() =>
    expect(
      notificationStore(client).get(
        getNotificationIdentityKey(makeNotification({ id: 1 })),
      )?.readAt,
    ).not.toBeNull(),
  );
  endSession(client);
  seedNotifications({ client, notifications: [makeNotification({ id: 2 })] });
  confirmation.release();
  await markedAll;

  expect(
    client.getQueryState(queryKeys.notificationsList())?.isInvalidated,
  ).toBe(false);
});

it("drops a list response that resolves after the session ends", async () => {
  const { client } = queryWrapper();
  const response = held();
  listed = () => response.until(list([makeNotification({ id: 1 })]));
  const loading = client.fetchQuery(notificationsCache(client).list());

  endSession(client);
  response.release();

  await expect(loading).rejects.toThrow();
  expect(
    notificationStore(client).get(
      getNotificationIdentityKey(makeNotification({ id: 1 })),
    ),
  ).toBeUndefined();
});

it("keeps a mounted list rendering when the session ends", async () => {
  const { client, wrapper } = queryWrapper();
  const bell = renderHook(() => useNotificationsList(20), { wrapper });
  await waitFor(() => expect(bell.result.current.data).toHaveLength(1));

  act(() => meCache(client).clear());
  bell.rerender();

  expect(bell.result.current.error).toBeNull();
});
