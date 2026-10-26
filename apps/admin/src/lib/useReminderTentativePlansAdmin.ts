import {
  actionRemindersTentativePlansForGroupAdmin,
  type CreateReminderGroupDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  hashKey,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

/**
 * The plans `group` would send if saved, fetched once it holds still for
 * 300ms. `plans` and `error` stay unset until they answer the latest `group`.
 */
export function useReminderTentativePlansAdmin(
  eventId: number | null,
  group: CreateReminderGroupDto | null,
) {
  const queryKey = useMemo(
    () => queryKeys.reminderTentativePlansAdmin(eventId, group),
    [eventId, group],
  );
  const [debouncedKey, setDebouncedKey] = useState(() =>
    queryKeys.reminderTentativePlansAdmin(null, null),
  );
  const queryClient = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKey((prev) =>
        hashKey(prev) === hashKey(queryKey) ? prev : queryKey,
      );
      // Settling back on a draft whose count failed counts it again.
      if (queryClient.getQueryState(queryKey)?.status === "error") {
        void queryClient.refetchQueries({ queryKey, exact: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryClient, queryKey]);

  const [, debouncedEventId, debouncedGroup] = debouncedKey;
  const query = useQuery({
    queryKey: debouncedKey,
    queryFn:
      debouncedEventId === null || debouncedGroup === null
        ? skipToken
        : () =>
            actionRemindersTentativePlansForGroupAdmin({
              path: { eventId: debouncedEventId },
              body: debouncedGroup,
              throwOnError: true,
            }).then((res) => res.data),
    // Retry asks again; backoff would hold the count back for seconds.
    retry: false,
    // A refetch withholds the count, which would hold submit on every focus.
    refetchOnWindowFocus: false,
    // A paused offline fetch would read as a finished count; failing shows Retry.
    networkMode: "always",
    // One plan list per paused-on draft, each carrying every recipient's user;
    // none is shown again from cache, so each goes with its observer.
    gcTime: 0,
  });

  // A count being refetched may predate a completion or a sent notif, so only
  // a finished fetch answers for the form.
  const current =
    hashKey(debouncedKey) === hashKey(queryKey) && !query.isFetching;
  return {
    plans: current && !query.isError ? query.data : undefined,
    error: current ? query.error : null,
    retry: () => void query.refetch(),
  };
}
