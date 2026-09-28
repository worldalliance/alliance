import { useQuery } from "@tanstack/react-query";
import { actionsAllUpdates, actionsRecentUpdates } from "../client";
import { queryKeys } from "./queryKeys";

export function useRecentActionUpdates(limit: number) {
  return useQuery({
    queryKey: queryKeys.actionUpdatesRecent(limit),
    queryFn: () =>
      actionsRecentUpdates({ query: { limit }, throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

export function useAllActionUpdates() {
  return useQuery({
    queryKey: queryKeys.actionUpdatesAll(),
    queryFn: () =>
      actionsAllUpdates({ throwOnError: true }).then((r) => r.data),
  });
}
