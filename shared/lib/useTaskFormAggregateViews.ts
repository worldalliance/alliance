import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import {
  skipToken,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { tasksGetFormAggregateViews } from "../client";
import { parseAggregateViewsPayload } from "./actionAggregates";
import { queryKeys } from "./queryKeys";

const NO_VIEWS: AggregateViewSchema[] = [];

const fetchAggregateViews = (formId: number) =>
  tasksGetFormAggregateViews({ path: { id: formId }, throwOnError: true }).then(
    (res) => parseAggregateViewsPayload(res.data.aggregateViews),
  );

const aggregateViewsQuery = (formId: number) => ({
  queryKey: queryKeys.taskFormAggregateViews(formId),
  queryFn: () => fetchAggregateViews(formId),
});

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

/** Views by form id, holding only the forms whose views have loaded. */
export function useTaskFormsAggregateViews(
  formIds: readonly number[],
): Record<number, AggregateViewSchema[]> {
  const uniqueFormIds = useMemo(() => [...new Set(formIds)], [formIds]);
  const combine = useCallback(
    (results: UseQueryResult<AggregateViewSchema[]>[]) =>
      Object.fromEntries(
        uniqueFormIds.flatMap((formId, i) => {
          const views = results[i]?.data;
          return views ? [[formId, views] as const] : [];
        }),
      ),
    [uniqueFormIds],
  );
  return useQueries({
    queries: uniqueFormIds.map(aggregateViewsQuery),
    combine,
  });
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
