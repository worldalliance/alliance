import { errorMessage } from "@alliance/common/errorMessage";
import { skipToken, useQuery } from "@tanstack/react-query";
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
              throw new Error(
                errorMessage({
                  error: response.error,
                  fallback: "Unable to load form",
                }),
              );
            }
            return response.data;
          },
    enabled: params?.enabled ?? true,
  });
}
