import { campaignFindAllAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export const campaignsLoadFailed = "Unable to load organizations.";

export function useCampaignsAdmin(params?: {
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.campaignsAdmin(),
    queryFn: () =>
      campaignFindAllAdmin({ throwOnError: true }).then((r) => r.data),
    ...params,
  });
}

export function useInvalidateCampaignsAdmin(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignsAdmin() }),
    [queryClient],
  );
}
