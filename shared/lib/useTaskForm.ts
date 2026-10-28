import { errorMessage } from "@alliance/common/errorMessage";
import {
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { tasksGetForm, tasksGetFormAdmin } from "../client";
import { queryKeys } from "./queryKeys";

const readForm = async (get: typeof tasksGetForm, formId: number) => {
  const response = await get({ path: { id: formId } });
  if (!response.data) {
    // The status lets retryUnlessRefused skip a refusal.
    throw Object.assign(
      new Error(
        errorMessage({
          error: response.error,
          fallback: "Unable to load form",
        }),
      ),
      { statusCode: response.response.status },
    );
  }
  return response.data;
};

const formQuery = ({
  formId,
  queryKey,
  get,
}: {
  formId: number | null | undefined;
  queryKey: readonly unknown[];
  get: typeof tasksGetForm;
}) =>
  queryOptions({
    queryKey,
    queryFn: formId == null ? skipToken : () => readForm(get, formId),
  });

/** The form as the signed-in member is served it, filled from their row. */
export const taskFormQuery = (formId: number | null | undefined) =>
  formQuery({
    formId,
    queryKey: queryKeys.taskForm(formId ?? null),
    get: tasksGetForm,
  });

/** The stored form, unfilled: for admin screens that edit, clone or report on it. */
export const adminTaskFormQuery = (formId: number | null | undefined) =>
  formQuery({
    formId,
    queryKey: queryKeys.taskFormAdmin(formId ?? null),
    get: tasksGetFormAdmin,
  });

export function useAdminTaskForm(formId: number | null | undefined) {
  return useQuery(adminTaskFormQuery(formId));
}

export function useTaskForm(
  formId: number | null | undefined,
  params?: { enabled?: boolean },
) {
  return useQuery({
    ...taskFormQuery(formId),
    enabled: params?.enabled ?? true,
  });
}

export function useInvalidateTaskForms(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.taskFormsAll() }),
    [queryClient],
  );
}
