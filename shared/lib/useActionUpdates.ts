import { useQuery } from "@tanstack/react-query";
import { actionUpdatesAllUpdates, actionUpdatesRecentUpdates } from "../client";
import { queryKeys } from "./queryKeys";

export function useRecentActionUpdates(limit: number) {
  return useQuery({
    queryKey: queryKeys.actionUpdatesRecent(limit),
    queryFn: () =>
      actionUpdatesRecentUpdates({ query: { limit }, throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

export function useAllActionUpdates() {
  return useQuery({
    queryKey: queryKeys.actionUpdatesAll(),
    queryFn: () =>
      actionUpdatesAllUpdates({ throwOnError: true }).then((r) => r.data),
  });
}
