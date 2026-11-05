import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { userNmembers } from "../client";
import { queryKeys } from "./queryKeys";
import { retryUnlessRefused } from "./retryQuery";

export function useAllianceMemberCount(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  return useQuery({
    queryKey: queryKeys.allianceMemberCount(),
    queryFn: () =>
      userNmembers({ throwOnError: true }).then((res) => res.data.count),
    enabled,
    retry: retryUnlessRefused(1),
  });
}

export function useInvalidateAllianceMemberCount(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.allianceMemberCount(),
    });
  }, [queryClient]);
}
