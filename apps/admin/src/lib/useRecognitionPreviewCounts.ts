import {
  actionsPreviewUpdateRecognitionCountsAdmin,
  type ActionUpdateNotifyType,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";

/** How many of the given, possibly unsaved, audience fall in each group. */
export function useRecognitionPreviewCounts(params: {
  updateId: number;
  notifyType: ActionUpdateNotifyType;
  tagId: string | null;
  enabled: boolean;
}) {
  const { updateId, notifyType, tagId, enabled } = params;
  const audience = { notifyType, tagId };
  return useQuery({
    queryKey: queryKeys.actionUpdateRecognitionPreviewCountsAdmin(
      updateId,
      audience,
    ),
    queryFn: enabled
      ? () =>
          actionsPreviewUpdateRecognitionCountsAdmin({
            path: { id: updateId },
            body: audience,
            throwOnError: true,
          }).then((r) => r.data)
      : skipToken,
  });
}
