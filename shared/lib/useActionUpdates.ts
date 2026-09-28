import { useQuery } from "@tanstack/react-query";
import { actionsRecentUpdates } from "../client";
import { queryKeys } from "./queryKeys";

export function useRecentActionUpdates(limit: number) {
  return useQuery({
    queryKey: queryKeys.actionUpdatesRecent(limit),
    queryFn: async () => {
      const { data } = await actionsRecentUpdates({
        query: { limit },
        throwOnError: true,
      });
      if (!Array.isArray(data)) {
        throw new Error("Recent action updates response is not a list");
      }
      return data;
    },
  });
}
