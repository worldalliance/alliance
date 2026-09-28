import { useQuery } from "@tanstack/react-query";
import { actionsAllUpdates, actionsRecentUpdates } from "../client";
import { queryKeys } from "./queryKeys";

function requireList<T>(data: T[], name: string): T[] {
  if (!Array.isArray(data)) {
    throw new Error(`${name} response is not a list`);
  }
  return data;
}

export function useRecentActionUpdates(limit: number) {
  return useQuery({
    queryKey: queryKeys.actionUpdatesRecent(limit),
    queryFn: () =>
      actionsRecentUpdates({ query: { limit }, throwOnError: true }).then((r) =>
        requireList(r.data, "Recent action updates"),
      ),
  });
}

export function useAllActionUpdates() {
  return useQuery({
    queryKey: queryKeys.actionUpdatesAll(),
    queryFn: () =>
      actionsAllUpdates({ throwOnError: true }).then((r) =>
        requireList(r.data, "Action updates"),
      ),
  });
}
