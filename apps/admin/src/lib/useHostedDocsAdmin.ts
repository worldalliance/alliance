import {
  type HostedDocsCreateAdminData,
  type UpdateHostedDocDto,
  hostedDocsCreateAdmin,
  hostedDocsFindAllAdmin,
  hostedDocsRemoveAdmin,
  hostedDocsReplaceFileAdmin,
  hostedDocsUpdateAdmin,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useHostedDocsAdmin() {
  return useQuery({
    queryKey: queryKeys.hostedDocsAdmin(),
    queryFn: () =>
      hostedDocsFindAllAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

function useInvalidateHostedDocsAdmin() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.hostedDocsAdmin() });
}

export function useCreateHostedDocAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateHostedDocsAdmin();
  return useMutation({
    mutationFn: (body: HostedDocsCreateAdminData["body"]) =>
      hostedDocsCreateAdmin({ body, throwOnError: true }),
    onSuccess: async () => {
      params.onSuccess();
      await invalidate();
    },
    onError: params.onError,
  });
}

export function useReplaceHostedDocFileAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateHostedDocsAdmin();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      hostedDocsReplaceFileAdmin({
        path: { id },
        body: { file },
        throwOnError: true,
      }),
    onSuccess: async () => {
      params.onSuccess();
      await invalidate();
    },
    onError: params.onError,
  });
}

export function useUpdateHostedDocAdmin(params: {
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateHostedDocsAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateHostedDocDto }) =>
      hostedDocsUpdateAdmin({ path: { id }, body, throwOnError: true }),
    onSuccess: invalidate,
    onError: params.onError,
  });
}

export function useDeleteHostedDocAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateHostedDocsAdmin();
  return useMutation({
    mutationFn: (id: number) =>
      hostedDocsRemoveAdmin({ path: { id }, throwOnError: true }).then(
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
