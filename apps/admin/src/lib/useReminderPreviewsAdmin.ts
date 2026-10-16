import {
  actionRemindersPreviewEmailHtmlAdmin,
  actionRemindersPreviewTextMessageAdmin,
  type PreviewEmailHtmlDto,
  type PreviewTextDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";

export function useReminderEmailPreviewAdmin(
  eventId: number | null,
  preview: PreviewEmailHtmlDto | null,
) {
  return useQuery({
    queryKey: queryKeys.reminderEmailPreviewAdmin(eventId, preview),
    queryFn:
      eventId === null || preview === null
        ? skipToken
        : () =>
            actionRemindersPreviewEmailHtmlAdmin({
              path: { eventId },
              body: preview,
              throwOnError: true,
            }).then((res) => res.data),
  });
}

/** Renders text and push messages alike. */
export function useReminderTextPreviewAdmin(
  eventId: number | null,
  preview: PreviewTextDto | null,
) {
  return useQuery({
    queryKey: queryKeys.reminderTextPreviewAdmin(eventId, preview),
    queryFn:
      eventId === null || preview === null
        ? skipToken
        : () =>
            actionRemindersPreviewTextMessageAdmin({
              path: { eventId },
              body: preview,
              throwOnError: true,
            }).then((res) => res.data.text),
  });
}
