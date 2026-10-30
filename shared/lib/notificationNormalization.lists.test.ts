import { act, renderHook, waitFor } from "@testing-library/react";
import type { NotificationDto } from "../client";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { notificationStore } from "./notificationStore";
import { queryKeys } from "./queryKeys";
import { makeNotification } from "./testFixtures";
import { accepted, list, serveNotifications } from "./testing/notificationApi";
import { held } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { seedNotifications } from "./testing/seedNotifications";
import {
  notificationsCache,
  useNotificationsList,
} from "./useNotificationsCache";

const api = serveNotifications();

const readStates = (notifications: NotificationDto[] | undefined) =>
  notifications?.map((notification) => notification.readAt !== null);

it("shows a list response in a list loaded earlier", async () => {
  const { wrapper } = queryWrapper();
  const bell = renderHook(() => useNotificationsList(20), { wrapper });
  await waitFor(() => expect(bell.result.current.data).toHaveLength(1));

  api.listed = () => list([makeNotification({ id: 1, message: "Edited" })]);
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
  api.listed = () =>
    older.until(list([makeNotification({ id: 1, message: "Older" })]));
  const loadingOlder = client.fetchQuery(cache.list());
  api.listed = () => list([makeNotification({ id: 1, message: "Newer" })]);
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
  api.listed = () => response.until(list([makeNotification({ id: 1 })]));
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
  api.readResponse = () => confirmation.until(accepted());
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
  api.readResponse = () => refusal.until(new Response(null, { status: 500 }));
  const cache = notificationsCache(client);

  const marked = cache.markRead([makeNotification({ id: 1 })]).catch(() => {});
  const response = held();
  api.listed = () => response.until(list([makeNotification({ id: 1 })]));
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

it("shows a list load's content for a record read while it loaded", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1, message: "Old" })],
  });
  const response = held();
  api.listed = () =>
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
