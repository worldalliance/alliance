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
  /** Members can open this form now or have answered it. */
  live: boolean;
  /** The response count or the task couldn't load, so whether it is live is unknown. */
  failed: boolean;
  loading: boolean;
  retry: () => void;
};

const NO_FORMS: readonly number[] = [];

/**
 * Who a save of this form reaches. A form is live when members can open its
 * task (the server's rule: public-only, or not archived and past Draft) or it
 * has responses. A follow-up form has no task in the index, so its responses
 * decide.
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
  const { forms, isLoading: formsLoading } = useFormsAdmin();
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
  const live = taskLive === true || (responses ?? 0) > 0;
  return {
    responses,
    task,
    taskLive,
    live,
    failed: !live && (status === ResponseCountStatus.Error || action.isError),
    loading:
      (given === undefined && formsLoading) ||
      status === ResponseCountStatus.Pending ||
      (task !== null && action.isPending),
    retry: () => {
      void queryClient.refetchQueries({
        queryKey: queryKeys.formResponseCountsAdmin(formIds),
      });
      if (action.isError) void action.refetch();
    },
  };
}
