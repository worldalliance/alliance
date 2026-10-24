import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { tasksGetFormAggregateViews } from "../client";
import { parseAggregateViewsPayload } from "./actionAggregates";
import { queryKeys } from "./queryKeys";

const NO_VIEWS: AggregateViewSchema[] = [];

const fetchAggregateViews = (formId: number) =>
  tasksGetFormAggregateViews({ path: { id: formId }, throwOnError: true }).then(
    (res) => parseAggregateViewsPayload(res.data.aggregateViews),
  );

/** The form's aggregate views totalled over every response to it; empty while
 * loading or after a failed load. */
export function useTaskFormAggregateViews(
  formId: number | null | undefined,
): AggregateViewSchema[] {
  const { data } = useQuery({
    queryKey: queryKeys.taskFormAggregateViews(formId ?? null),
    queryFn: formId == null ? skipToken : () => fetchAggregateViews(formId),
  });
  return data ?? NO_VIEWS;
}

/** For any write that adds to or replaces a response to the form. */
export function useInvalidateTaskFormAggregateViews(): (
  formId: number,
) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (formId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.taskFormAggregateViews(formId),
      });
    },
    [queryClient],
  );
}
