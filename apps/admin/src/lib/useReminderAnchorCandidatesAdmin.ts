import { actionRemindersReminderAnchorCandidatesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";

export function useReminderAnchorCandidatesAdmin(eventId: number | null) {
  return useQuery({
    queryKey: queryKeys.actionReminderAnchorCandidatesAdmin(eventId),
    queryFn:
      eventId === null
        ? skipToken
        : () =>
            actionRemindersReminderAnchorCandidatesAdmin({
              path: { eventId },
              throwOnError: true,
            }).then((res) => res.data),
  });
}
