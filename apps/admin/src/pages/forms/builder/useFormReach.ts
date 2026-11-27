import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { actionAdminQuery } from "@alliance/shared/lib/useActionAdmin";
import {
  ResponseCountStatus,
  useFormResponseCountsAdmin,
  useFormsAdmin,
} from "@alliance/shared/lib/useFormsAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

/** The task a form belongs to, as its mount or the forms index names it. */
export type FormTask = { id: number; name: string };

export type FormReach = {
  /** Response rows for this form; null while loading, after a failure, or for a new or display-only form. */
  responses: number | null;
  /** The task the form belongs to; null for a follow-up or standalone form. */
  task: FormTask | null;
  /** Whether members can open that task now; undefined without one, or while it loads. */
  taskLive: boolean | undefined;
  /** Members can open the form's task now, or have answered it outside a draft. */
  live: boolean;
  /** The task, or for a form without one its response count, couldn't load, so whether it is live is unknown. */
  failed: boolean;
  loading: boolean;
  retry: () => void;
};

const NO_FORMS: readonly number[] = [];

/**
 * Who a save of this form reaches. A form with a task is live when members
 * can open that task (the server's rule: public-only, or not archived and past
 * Draft), or when the task is past Draft and has responses, which an archived
 * task keeps for when it is unarchived; a draft's come from staff previews. A
 * follow-up form has no task in the index, so its responses decide.
 */
export function useFormReach({
  formId,
  task: given,
  displayOnly,
}: {
  formId: number | undefined;
  task: FormTask | undefined;
  displayOnly: boolean;
}): FormReach {
  const counted = !displayOnly && formId !== undefined;
  const {
    forms,
    isLoading: formsLoading,
    isError: formsFailed,
  } = useFormsAdmin();
  const task =
    given ??
    (counted ? forms.find(({ id }) => id === formId)?.usedInAction : null) ??
    null;
  const action = useQuery({
    ...actionAdminQuery(task?.id ?? null),
    enabled: counted && task !== null,
  });
  const formIds = useMemo(
    () => (counted ? [formId] : NO_FORMS),
    [counted, formId],
  );
  const counts = useFormResponseCountsAdmin(formIds);
  const queryClient = useQueryClient();

  if (!counted) {
    return {
      responses: null,
      task,
      taskLive: undefined,
      live: false,
      failed: false,
      loading: false,
      retry: () => {},
    };
  }
  const status = counts.statusByForm[formId] ?? ResponseCountStatus.Pending;
  const responses = counts.byForm[formId] ?? null;
  const loaded = action.data?.action;
  const taskLive = loaded
    ? loaded.publicOnly || (!loaded.archived && loaded.status !== "draft")
    : undefined;
  const indexFailed = given === undefined && formsFailed;
  const answered = (responses ?? 0) > 0;
  const live =
    task === null
      ? answered
      : taskLive === true ||
        (loaded !== undefined && loaded.status !== "draft" && answered);
  const countDecides =
    task === null ||
    (loaded !== undefined && loaded.status !== "draft" && !taskLive);
  const unknown =
    (task === null ? indexFailed : action.isError) ||
    (countDecides && status === ResponseCountStatus.Error);
  return {
    responses,
    task,
    taskLive,
    live,
    failed: !live && unknown,
    loading:
      (given === undefined && formsLoading) ||
      (task !== null && action.isPending) ||
      (countDecides && status === ResponseCountStatus.Pending),
    retry: () => {
      void queryClient.refetchQueries({
        queryKey: queryKeys.formResponseCountsAdmin(formIds),
      });
      if (action.isError) void action.refetch();
      if (indexFailed) {
        void queryClient.refetchQueries({ queryKey: queryKeys.formsAdmin() });
      }
    },
  };
}
