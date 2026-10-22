import {
  type CreateCustomLinkDto,
  type UpdateCustomLinkDto,
  customLinksCreateAdmin,
  customLinksFindAllAdmin,
  customLinksRemoveAdmin,
  customLinksUpdateAdmin,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCustomLinksAdmin() {
  return useQuery({
    queryKey: queryKeys.customLinksAdmin(),
    queryFn: () =>
      customLinksFindAllAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

function useInvalidateCustomLinksAdmin() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.customLinksAdmin() });
}

export function useCreateCustomLinkAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateCustomLinksAdmin();
  return useMutation({
    mutationFn: (body: CreateCustomLinkDto) =>
      customLinksCreateAdmin({ body, throwOnError: true }),
    onSuccess: async () => {
      params.onSuccess();
      await invalidate();
    },
    onError: params.onError,
  });
}

export function useUpdateCustomLinkAdmin(params: {
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateCustomLinksAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateCustomLinkDto }) =>
      customLinksUpdateAdmin({ path: { id }, body, throwOnError: true }),
    onSuccess: invalidate,
    onError: params.onError,
  });
}

export function useDeleteCustomLinkAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateCustomLinksAdmin();
  return useMutation({
    mutationFn: (id: number) =>
      customLinksRemoveAdmin({ path: { id }, throwOnError: true }).then(
        () => undefined,
        rethrowUnlessNotFound,
      ),
    onSuccess: async () => {
      params.onSuccess();
      await invalidate();
    },
    onError: params.onError,
  });
}
