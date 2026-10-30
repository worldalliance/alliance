import { waitFor } from "@testing-library/react";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { notificationStore } from "./notificationStore";
import { queryKeys } from "./queryKeys";
import { makeNotification } from "./testFixtures";
import {
  accepted,
  LOADED_AT,
  serveNotifications,
} from "./testing/notificationApi";
import { held } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { seedNotifications } from "./testing/seedNotifications";
import { notificationsCache } from "./useNotificationsCache";

const api = serveNotifications();

const AFTER_LOAD = "2026-09-23T12:00:00.001Z";

it("keeps mark-all-read in a list load that starts before the server confirms it", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const confirmation = held();
  api.readAllResponse = () => confirmation.until(accepted());
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

it("marks read only what the server marks when marking all read", async () => {
  const { client } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 })],
    limit: 20,
    loadedAt: LOADED_AT,
  });
  seedNotifications({
    client,
    notifications: [
      makeNotification({ id: 2, sendTime: AFTER_LOAD, createdAt: AFTER_LOAD }),
      makeNotification({ id: 3, sendTime: AFTER_LOAD }),
      makeNotification({ id: 4, createdAt: AFTER_LOAD }),
      makeNotification({ id: 1 }),
    ],
  });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 4);
  const confirmation = held();
  api.readAllResponse = () => confirmation.until(accepted());

  const marked = notificationsCache(client).markAllRead(20);
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(3),
  );

  const store = notificationStore(client);
  const readAt = (id: number) =>
    store.get(getNotificationIdentityKey(makeNotification({ id })))?.readAt;
  expect(readAt(1)).not.toBeNull();
  expect([2, 3, 4].map(readAt)).toEqual([null, null, null]);
  confirmation.release();
  await marked;
});

it("never raises the count when marking all read", async () => {
  const { client } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 })],
    limit: 20,
    loadedAt: LOADED_AT,
  });
  notificationStore(client).receive([
    makeNotification({ id: 2, sendTime: AFTER_LOAD, createdAt: AFTER_LOAD }),
    makeNotification({ id: 3, sendTime: AFTER_LOAD, createdAt: AFTER_LOAD }),
  ]);
  client.setQueryData(queryKeys.notificationsUnreadCount(), 1);
  const confirmation = held();
  api.readAllResponse = () => confirmation.until(accepted());

  const markedAll = notificationsCache(client).markAllRead(20);
  await waitFor(() =>
    expect(
      notificationStore(client).get(
        getNotificationIdentityKey(makeNotification({ id: 1 })),
      )?.readAt,
    ).not.toBeNull(),
  );

  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(1);
  confirmation.release();
  await markedAll;
});

it("restores the count a failed mark-all-read replaced", async () => {
  const { client } = queryWrapper();
  seedNotifications({
    client,
    notifications: [
      makeNotification({ id: 1 }),
      makeNotification({ id: 2, sendTime: AFTER_LOAD, createdAt: AFTER_LOAD }),
    ],
    loadedAt: LOADED_AT,
  });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 5);
  const refusal = held();
  api.readAllResponse = () =>
    refusal.until(new Response(null, { status: 500 }));

  const markedAll = notificationsCache(client).markAllRead();
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(1),
  );
  refusal.release();
  await markedAll;

  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(5);
});

it("replaces a count load in flight with a refetch when mark-all-read fails", async () => {
  const { client } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 }), makeNotification({ id: 2 })],
  });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 2);
  const refusal = held();
  api.readAllResponse = () =>
    refusal.until(new Response(null, { status: 500 }));

  const cache = notificationsCache(client);
  const markedAll = cache.markAllRead();
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(0),
  );
  const response = held();
  api.counted = () => response.until(Response.json({ unreadCount: 3 }));
  const loading = client
    .fetchQuery({ ...cache.unreadCount, staleTime: 0 })
    .catch(() => {});
  refusal.release();
  await markedAll;
  response.release();
  await loading;

  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(2);
  expect(
    client.getQueryState(queryKeys.notificationsUnreadCount())?.isInvalidated,
  ).toBe(true);
});
