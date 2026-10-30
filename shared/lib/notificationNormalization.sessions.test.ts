import { act, renderHook, waitFor } from "@testing-library/react";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { notificationStore } from "./notificationStore";
import { queryKeys } from "./queryKeys";
import { currentSession, endSession } from "./sessionStores";
import { makeNotification } from "./testFixtures";
import {
  accepted,
  list,
  LOADED_AT,
  serveNotifications,
} from "./testing/notificationApi";
import { held } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { seedNotifications } from "./testing/seedNotifications";
import { meCache } from "./useMe";
import {
  notificationsCache,
  useNotificationsList,
} from "./useNotificationsCache";

const api = serveNotifications();

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
  api.readAllResponse = () =>
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
  api.readAllResponse = () => {
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
  api.readResponse = () => refusal.until(new Response(null, { status: 500 }));

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
  api.readAllResponse = () => confirmation.until(accepted());

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
  api.listed = () => response.until(list([makeNotification({ id: 1 })]));
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
