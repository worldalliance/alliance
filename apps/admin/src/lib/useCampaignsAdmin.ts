import {
  campaignCreateAdmin,
  campaignFindAllAdmin,
  campaignUpdateAdmin,
  type CampaignDto,
  type CreateCampaignDto,
  type UpdateCampaignDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useCreateCampaignAdmin(params: {
  onSuccess: (created: CampaignDto) => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidate = useInvalidateCampaignsAdmin();
  return useMutation({
    mutationFn: (body: CreateCampaignDto) =>
      campaignCreateAdmin({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: async (created) => {
      await invalidate();
      onSuccess(created);
    },
    onError,
  });
}

export function useUpdateCampaignAdmin(params: {
  onSuccess?: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidate = useInvalidateCampaignsAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateCampaignDto }) =>
      campaignUpdateAdmin({ path: { id }, body, throwOnError: true }),
    onSuccess,
    onError,
    onSettled: () => invalidate(),
  });
}
