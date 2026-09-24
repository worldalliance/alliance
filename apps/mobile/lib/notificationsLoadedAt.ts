import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { notifsFindAll, notifsSetReadAll } from "@alliance/shared/client";
import { QueryClient } from "@tanstack/react-query";

export const LOADED_AT_QUERY_KEY = ["notifications", "loadedAt"];

export async function fetchNotifications(
  queryClient: QueryClient,
  signal: AbortSignal,
) {
  const res = await notifsFindAll({ signal });
  queryClient.setQueryData(
    LOADED_AT_QUERY_KEY,
    res.response.headers.get(NOTIFS_LOADED_AT_HEADER),
  );
  return res.data;
}

// Rows that came due after the load stay unread, so the list and badge
// refetch to show them.
export async function markAllNotificationsRead(queryClient: QueryClient) {
  const loadedAt = queryClient.getQueryData<string | null>(LOADED_AT_QUERY_KEY);
  await notifsSetReadAll({ query: { loadedAt: loadedAt ?? undefined } });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
}
