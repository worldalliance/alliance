import { waitFor } from "@testing-library/react";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { notificationStore } from "./notificationStore";
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
