import {
  type CreateWaitlistLinkDto,
  type UpdateWaitlistLinkDto,
  waitlistAdminCreateLinkAdmin,
  waitlistAdminFindLinksAdmin,
  waitlistAdminUpdateLinkAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const waitlistLinksLoadFailed = "Unable to load waitlist links.";

export function useWaitlistLinksAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistLinksAdmin(),
    queryFn: () =>
      waitlistAdminFindLinksAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

function useInvalidateWaitlistLinksAdmin() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlistLinksAdmin() });
}

export function useCreateWaitlistLinkAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidate = useInvalidateWaitlistLinksAdmin();
  return useMutation({
    mutationFn: (body: CreateWaitlistLinkDto) =>
      waitlistAdminCreateLinkAdmin({ body, throwOnError: true }),
    onSuccess: async () => {
      onSuccess();
      await invalidate();
    },
    onError,
  });
}

export function useUpdateWaitlistLinkAdmin(params: {
  onSettled: () => void;
  onError: (err: Error) => void;
}) {
  const { onSettled, onError } = params;
  const invalidate = useInvalidateWaitlistLinksAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateWaitlistLinkDto }) =>
      waitlistAdminUpdateLinkAdmin({ path: { id }, body, throwOnError: true }),
    onSettled: async () => {
      onSettled();
      await invalidate();
    },
    onError,
  });
}
