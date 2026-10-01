import { errorMessage } from "@alliance/common/errorMessage";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { tasksGetForm } from "../client";
import { queryKeys } from "./queryKeys";

export function useTaskForm(
  formId: number | undefined,
  params?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.taskForm(formId ?? null),
    queryFn:
      formId === undefined
        ? skipToken
        : async () => {
            const response = await tasksGetForm({ path: { id: formId } });
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
          },
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
