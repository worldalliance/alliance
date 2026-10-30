import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { QueryClient } from "@tanstack/react-query";
import type { NotificationDto } from "../client";
import { getNotificationIdentityKey } from "./notificationIdentity";
import { queryKeys } from "./queryKeys";
import { currentSession, sessionLoads, sessionStore } from "./sessionStores";

type NotificationRecord = {
  key: string;
  notification: NotificationDto;
  /** The start of the load that last set it; that load's value already holds
   * the writes made while it was in flight. */
  revision: number;
};
const adapter = createEntityAdapter({
  selectId: (record: NotificationRecord) => record.key,
});
const slice = createSlice({
  name: "notifications",
  initialState: adapter.getInitialState(),
  reducers: {
    received: (
      state,
      {
        payload,
      }: PayloadAction<{ notifications: NotificationDto[]; revision: number }>,
    ) => {
      for (const notification of payload.notifications) {
        const key = getNotificationIdentityKey(notification);
        if (payload.revision > (state.entities[key]?.revision ?? 0))
          adapter.setOne(state, {
            key,
            notification,
            revision: payload.revision,
          });
      }
    },
    written: (state, { payload }: PayloadAction<NotificationDto[]>) => {
      for (const notification of payload) {
        const current =
          state.entities[getNotificationIdentityKey(notification)];
        if (current) current.notification = notification;
      }
    },
    cleared: () => adapter.getInitialState(),
  },
});

export type NotificationState = ReturnType<typeof slice.reducer>;

/** A list's records in server order, and when the server read them: read-all's cutoff for that list. */
export type NotificationList = { keys: string[]; loadedAt: string | null };

/** Returns the changed record, or undefined to leave it as it is. */
export type NotificationChange = (
  notification: NotificationDto,
) => NotificationDto | undefined;

function createNotificationStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  const lists = sessionLoads<NotificationDto[]>({
    queryClient,
    queryKey: queryKeys.notificationsLists(),
  });
  const counts = sessionLoads<number>({
    queryClient,
    queryKey: queryKeys.notificationsUnreadCount(),
  });
  const all = () =>
    adapter
      .getSelectors()
      .selectAll(store.getState())
      .map((record) => record.notification);

  let countDowns = new Set<Promise<unknown>>();

  const receive = (
    notifications: NotificationDto[],
    revision = lists.nextRevision(),
  ) => {
    store.dispatch(slice.actions.received({ notifications, revision }));
    return notifications.map(getNotificationIdentityKey);
  };

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    get: (key: string) => store.getState().entities[key]?.notification,
    receive,
    clear: () => {
      countDowns = new Set();
      store.dispatch(slice.actions.cleared());
    },
    loadList: async (load: {
      signal: AbortSignal;
      fetch: () => Promise<{
        notifications: NotificationDto[];
        loadedAt: string | null;
      }>;
    }): Promise<NotificationList> => {
      let loadedAt: string | null = null;
      const { value, revision } = await lists.load({
        signal: load.signal,
        fetch: () =>
          load.fetch().then((response) => {
            loadedAt = response.loadedAt;
            return response.notifications;
          }),
      });
      return { keys: receive(value, revision), loadedAt };
    },
    loadUnreadCount: async (load: {
      signal: AbortSignal;
      fetch: () => Promise<number>;
    }) => (await counts.load(load)).value,
    /** Returns the keys of the records it changed, none once `session` has ended. */
    write: (params: {
      session: number;
      change: NotificationChange;
      confirmation?: Promise<unknown>;
    }) => {
      if (params.session !== currentSession(queryClient)) return [];
      lists.write(
        (notifications) =>
          notifications.map(
            (notification) => params.change(notification) ?? notification,
          ),
        params.confirmation,
      );
      const changed = all().flatMap(
        (notification) => params.change(notification) ?? [],
      );
      store.dispatch(slice.actions.written(changed));
      return changed.map(getNotificationIdentityKey);
    },
    /** Tracks a write that lowers the server's count until `confirmation`
     * settles; the returned check, made after it settles, says whether no other
     * is pending. */
    trackCountDown: (confirmation: Promise<unknown>) => {
      const pending = countDowns;
      pending.add(confirmation);
      const settle = () => void pending.delete(confirmation);
      void confirmation.then(settle, settle);
      return () => pending.size === 0;
    },
    writeUnreadCount: (params: {
      session: number;
      update: (count: number) => number;
    }) => {
      if (params.session !== currentSession(queryClient)) return;
      counts.write(params.update);
      queryClient.setQueryData<number>(
        queryKeys.notificationsUnreadCount(),
        (count) => (count === undefined ? undefined : params.update(count)),
      );
    },
  };
}

export const notificationStore = sessionStore(createNotificationStore);

export function selectNotification(
  state: NotificationState,
  key: string,
): NotificationDto {
  const record = state.entities[key];
  if (!record)
    throw new Error(`Notification ${key} is missing from the entity store`);
  return record.notification;
}
