import { waitFor } from "@testing-library/react";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { notificationStore } from "./notificationStore";
import { queryKeys } from "./queryKeys";
import { makeNotification } from "./testFixtures";
import { accepted, serveNotifications } from "./testing/notificationApi";
import { held } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { seedNotifications } from "./testing/seedNotifications";
import { notificationsCache } from "./useNotificationsCache";

const api = serveNotifications();

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
