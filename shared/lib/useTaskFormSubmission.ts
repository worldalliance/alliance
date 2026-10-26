import { useCallback } from "react";
import { OptOutActionDto, tasksOptout } from "../client";
import { useRecordActionRelation } from "./actionsListPage";
import { useInvalidateTaskFormAggregateViews } from "./useTaskFormAggregateViews";
import { useInvalidateVisibilityContext } from "./useVisibilityContext";

/**
 * The viewer's writes of a response to an action's task form, each updating
 * the caches the response moves once the server accepts it. Each resolves to
 * the client's result, refusals included, for the caller to explain, even
 * where the client is configured to throw on a refusal, as on mobile.
 */
export function useTaskFormSubmission() {
  const recordRelation = useRecordActionRelation();
  const invalidateVisibilityContext = useInvalidateVisibilityContext();
  const invalidateAggregateViews = useInvalidateTaskFormAggregateViews();

  const optOut = useCallback(
    async (taskFormId: number, body: OptOutActionDto) => {
      const result = await tasksOptout({
        path: { id: taskFormId },
        body,
        throwOnError: false,
      });
      if (result.response.ok) {
        recordRelation(body.actionId, "declined");
        invalidateVisibilityContext();
        invalidateAggregateViews(taskFormId);
      }
      return result;
    },
    [invalidateAggregateViews, invalidateVisibilityContext, recordRelation],
  );

  return { optOut };
}
