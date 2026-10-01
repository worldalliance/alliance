import {
  waitlistEmailAdminFindEmailAdmin,
  waitlistEmailAdminFindEmailsAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
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
