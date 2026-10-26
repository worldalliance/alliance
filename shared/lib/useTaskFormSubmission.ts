import { ExceptionEvent } from "@alliance/common/analytics";
import { GUEST_HEADER } from "@alliance/common/guest";
import { R, type Result } from "@alliance/common/result";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  FollowUpFormDto,
  OptOutActionDto,
  SubmitFormDto,
  tasksOptout,
  tasksSubmitFollowUpForm,
  tasksSubmitForm,
  tasksSubmitPublicForm,
} from "../client";
import {
  formulaSourcesChanged,
  type SubmitResult,
} from "../forms/formulaChoices";
import { invalidateActions, useRecordActionRelation } from "./actionsListPage";
import { captureException } from "./analytics";
import { queryKeys } from "./queryKeys";
import { resetHomeFeed } from "./useHomeFeed";
import { useInvalidateTaskFormAggregateViews } from "./useTaskFormAggregateViews";
import { useInvalidateVisibilityContext } from "./useVisibilityContext";

/**
 * The viewer's writes of a response to an action's task form or follow-up
 * form, each updating the caches the response moves once the server accepts
 * it. Each resolves to the client's result, refusals included, for the caller
 * to explain, even where the client is configured to throw on a refusal, as on
 * mobile.
 */
export function useTaskFormSubmission() {
  const queryClient = useQueryClient();
  const recordRelation = useRecordActionRelation();
  const invalidateVisibilityContext = useInvalidateVisibilityContext();
  const invalidateAggregateViews = useInvalidateTaskFormAggregateViews();

  const submit = useCallback(
    async ({
      taskFormId,
      body,
      isMember,
      guestToken,
    }: {
      taskFormId: number;
      body: SubmitFormDto;
      isMember: boolean;
      /** Sent with a guest's submission to keep their guest session. */
      guestToken?: string | null;
    }) => {
      const result = isMember
        ? await tasksSubmitForm({
            path: { id: taskFormId },
            body,
            throwOnError: false,
          })
        : await tasksSubmitPublicForm({
            path: { id: taskFormId },
            body,
            headers: guestToken ? { [GUEST_HEADER]: guestToken } : undefined,
            throwOnError: false,
          });
      if (result.response.ok) {
        invalidateAggregateViews(taskFormId);
        if (isMember) {
          // Bumped `completedActionCount` (and `firstContractSignedAt` for a
          // contract-signing action).
          invalidateVisibilityContext();
          recordRelation(body.actionId, "completed");
        }
      }
      return result;
    },
    [invalidateAggregateViews, invalidateVisibilityContext, recordRelation],
  );

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

  const submitFollowUp = useCallback(
    async ({
      followUpForm,
      data,
    }: {
      followUpForm: Pick<FollowUpFormDto, "id" | "formId">;
      data: SubmitFormDto;
    }): Promise<Result<void, SubmitResult>> => {
      const { actionId, ...body } = data;
      const response = await tasksSubmitFollowUpForm({
        path: { followUpFormId: followUpForm.id },
        body,
        throwOnError: false,
      });
      if (!response.response.ok) {
        if (!formulaSourcesChanged(response)) {
          console.error(response.error);
          captureException(
            ExceptionEvent.FollowUpFormSubmitError,
            response.error,
            { actionId, followUpFormId: followUpForm.id },
          );
        }
        return R.failure(response);
      }
      invalidateAggregateViews(followUpForm.formId);
      // The response can move the viewer into or out of a cohort that gates
      // actions and their follow-up forms.
      invalidateActions(queryClient);
      // The submission's activity shows in feeds, the viewer's own included.
      resetHomeFeed(queryClient);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activitiesAll(),
      });
      return R.success(undefined);
    },
    [invalidateAggregateViews, queryClient],
  );

  return { submit, optOut, submitFollowUp };
}
