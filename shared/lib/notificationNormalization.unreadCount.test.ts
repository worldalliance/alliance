import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { endSession } from "./sessionStores";
import { makeNotification } from "./testFixtures";
import { accepted, serveNotifications } from "./testing/notificationApi";
import { held } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { seedNotifications } from "./testing/seedNotifications";
import {
  notificationsCache,
  useUnreadNotificationCount,
} from "./useNotificationsCache";

const api = serveNotifications();

it("takes the server's count after a read it may have counted down twice", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 }), makeNotification({ id: 2 })],
  });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 2);
  const confirmation = held();
  api.readResponse = () => confirmation.until(accepted());
  api.counted = () => Response.json({ unreadCount: 2 });
  const count = renderHook(() => useUnreadNotificationCount(), { wrapper });
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.fetchStatus,
    ).toBe("idle"),
  );

  const response = held();
  api.counted = () => response.until(Response.json({ unreadCount: 1 }));
  const loading = client.refetchQueries({
    queryKey: queryKeys.notificationsUnreadCount(),
  });
  const marked = notificationsCache(client).markRead([
    makeNotification({ id: 1 }),
  ]);
  response.release();
  await act(() => loading);
  expect(client.getQueryData(queryKeys.notificationsUnreadCount())).toBe(0);
  confirmation.release();
  await act(() => marked);

  await waitFor(() => expect(count.result.current).toBe(1));
});

it("counts down a read made while the unread count loads", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const response = held();
  api.counted = () => response.until(Response.json({ unreadCount: 1 }));
  const confirmation = held();
  api.readResponse = () => confirmation.until(accepted());
  const count = renderHook(() => useUnreadNotificationCount(), { wrapper });

  const marked = notificationsCache(client).markRead([
    makeNotification({ id: 1 }),
  ]);
  response.release();

  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.status,
    ).toBe("success"),
  );
  expect(count.result.current).toBe(0);
  api.counted = () => Response.json({ unreadCount: 0 });
  confirmation.release();
  await act(() => marked);
});

it("takes the server's count after a read settles during the first count load", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 }), makeNotification({ id: 2 })],
  });
  const response = held();
  api.counted = () => response.until(Response.json({ unreadCount: 1 }));
  const count = renderHook(() => useUnreadNotificationCount(), { wrapper });
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.fetchStatus,
    ).toBe("fetching"),
  );

  await act(() =>
    notificationsCache(client).markRead([makeNotification({ id: 1 })]),
  );
  api.counted = () => Response.json({ unreadCount: 1 });
  response.release();

  await waitFor(() => expect(count.result.current).toBe(1));
});

it("takes the server's count after a refused read during the first count load", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  api.readResponse = () => new Response(null, { status: 500 });
  const response = held();
  api.counted = () => response.until(Response.json({ unreadCount: 1 }));
  const count = renderHook(() => useUnreadNotificationCount(), { wrapper });
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.fetchStatus,
    ).toBe("fetching"),
  );

  await act(() =>
    notificationsCache(client)
      .markRead([makeNotification({ id: 1 })])
      .catch(() => {}),
  );
  api.counted = () => Response.json({ unreadCount: 1 });
  response.release();

  await waitFor(() => expect(count.result.current).toBe(1));
});

it("counts a count load in flight down to no fewer than zero", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  const response = held();
  api.counted = () => response.until(Response.json({ unreadCount: 0 }));
  const confirmation = held();
  api.readResponse = () => confirmation.until(accepted());
  const cache = notificationsCache(client);

  const loading = client.fetchQuery({ ...cache.unreadCount, staleTime: 0 });
  const marked = cache.markRead([makeNotification({ id: 1 })]);
  response.release();

  expect(await loading).toBe(0);
  confirmation.release();
  await marked;
});

it("keeps the count of a read still pending when another read settles", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 }), makeNotification({ id: 2 })],
  });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 2);
  let serverCount = 2;
  const reads = [held(), held()];
  let readsSent = 0;
  api.readResponse = () =>
    reads[readsSent++]!.until(null).then(() => {
      serverCount--;
      return accepted();
    });
  api.counted = () => Response.json({ unreadCount: serverCount });
  const count = renderHook(() => useUnreadNotificationCount(), { wrapper });
  const cache = notificationsCache(client);

  const first = cache.markRead([makeNotification({ id: 1 })]);
  const second = cache.markRead([makeNotification({ id: 2 })]);
  reads[0]!.release();
  await act(() => first);
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.fetchStatus,
    ).toBe("idle"),
  );

  expect(count.result.current).toBe(0);
  reads[1]!.release();
  await act(() => second);
});

it("keeps mark-all-read's count when a read settles while it is pending", async () => {
  const { client, wrapper } = queryWrapper();
  seedNotifications({
    client,
    notifications: [makeNotification({ id: 1 }), makeNotification({ id: 2 })],
  });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 2);
  let serverCount = 2;
  const read = held();
  api.readResponse = () =>
    read.until(null).then(() => {
      serverCount--;
      return accepted();
    });
  const readAll = held();
  api.readAllResponse = () =>
    readAll.until(null).then(() => {
      serverCount = 0;
      return accepted();
    });
  api.counted = () => Response.json({ unreadCount: serverCount });
  const count = renderHook(() => useUnreadNotificationCount(), { wrapper });
  const cache = notificationsCache(client);

  const marked = cache.markRead([makeNotification({ id: 1 })]);
  const markedAll = cache.markAllRead();
  await waitFor(() => expect(count.result.current).toBe(0));
  read.release();
  await act(() => marked);
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.fetchStatus,
    ).toBe("idle"),
  );

  expect(count.result.current).toBe(0);
  readAll.release();
  await act(() => markedAll);
});

it("refetches the count for a new session's read while an old session's read is pending", async () => {
  const { client } = queryWrapper();
  seedNotifications({ client, notifications: [makeNotification({ id: 1 })] });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 1);
  const oldRead = held();
  let readsSent = 0;
  api.readResponse = () =>
    readsSent++ === 0 ? oldRead.until(accepted()) : accepted();
  const cache = notificationsCache(client);

  const old = cache.markRead([makeNotification({ id: 1 })]);
  endSession(client);
  seedNotifications({ client, notifications: [makeNotification({ id: 2 })] });
  client.setQueryData(queryKeys.notificationsUnreadCount(), 1);
  await cache.markRead([makeNotification({ id: 2 })]);

  expect(
    client.getQueryState(queryKeys.notificationsUnreadCount())?.isInvalidated,
  ).toBe(true);
  oldRead.release();
  await old;
});
