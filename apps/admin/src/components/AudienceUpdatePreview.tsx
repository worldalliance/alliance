import type { RecognitionPreviewCountsDto } from "@alliance/shared/client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ActionUpdateForm } from "../lib/actionUpdateDetails";
import { useRecognitionPreviewCounts } from "../lib/useRecognitionPreviewCounts";
import {
  PreviewCountsKind,
  UpdatePreview,
  type PreviewCounts,
} from "./UpdatePreview";

const previewCountsOf = (
  form: ActionUpdateForm,
  query: UseQueryResult<RecognitionPreviewCountsDto>,
): PreviewCounts => {
  if (form.notifyType === "none") {
    return {
      kind: PreviewCountsKind.Counted,
      counts: {
        completed: 0,
        didNotComplete: 0,
        uninvolved: 0,
      },
    };
  }
  if (form.notifyType === "tag" && !form.tagId) {
    return {
      kind: PreviewCountsKind.Unavailable,
      reason: "Pick a tag to count recipients.",
    };
  }
  if (query.data) {
    return { kind: PreviewCountsKind.Counted, counts: query.data };
  }
  return query.isError
    ? {
        kind: PreviewCountsKind.Unavailable,
        reason: "Couldn't count the recipients.",
      }
    : { kind: PreviewCountsKind.Pending };
};

export function AudienceUpdatePreview({
  updateId,
  form,
}: {
  updateId: number;
  form: ActionUpdateForm;
}) {
  const countsTagId = form.notifyType === "tag" ? form.tagId || null : null;
  const countsQuery = useRecognitionPreviewCounts({
    updateId,
    notifyType: form.notifyType,
    tagId: countsTagId,
    enabled:
      form.notifyType !== "none" &&
      (form.notifyType !== "tag" || countsTagId !== null),
  });
  return (
    <UpdatePreview texts={form} counts={previewCountsOf(form, countsQuery)} />
  );
}
