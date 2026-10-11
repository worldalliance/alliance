import { useQuery } from "@tanstack/react-query";
import { tasksGetLinkedGuestDraft } from "../client";
import { queryKeys } from "./queryKeys";

/** The latest response a guest left on this form before signing in as the
 * member; null when there is none or the member has submitted the form
 * themselves. */
export function useLinkedGuestDraft({
  taskFormId,
  enabled,
}: {
  taskFormId: number;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.linkedGuestDraft(taskFormId),
    queryFn: () =>
      tasksGetLinkedGuestDraft({
        path: { id: taskFormId },
        throwOnError: true,
      }).then((res) => res.data.draft ?? null),
    enabled,
  });
}
