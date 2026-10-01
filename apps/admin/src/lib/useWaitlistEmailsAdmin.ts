import {
  waitlistEmailAdminFindEmailAdmin,
  waitlistEmailAdminFindEmailsAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { inProgress, SENDING_POLL_MS } from "./waitlistEmail";

export function useWaitlistEmailsAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistEmailsAdmin(),
    queryFn: () =>
      waitlistEmailAdminFindEmailsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    refetchInterval: (query) =>
      query.state.data?.some(inProgress) ? SENDING_POLL_MS : false,
  });
}

export function useWaitlistEmailAdmin(id: number) {
  return useQuery({
    queryKey: queryKeys.waitlistEmailAdmin(id),
    queryFn: () =>
      waitlistEmailAdminFindEmailAdmin({
        path: { id },
        throwOnError: true,
      }).then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data)
        ? SENDING_POLL_MS
        : false,
  });
}

/** Refreshes one email's detail and the list its counts appear in. */
export function useInvalidateWaitlistEmailAdmin(
  id: number,
): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistEmailAdmin(id),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistEmailsAdmin(),
      }),
    ]);
  }, [queryClient, id]);
}
