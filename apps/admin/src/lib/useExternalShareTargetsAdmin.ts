import {
  type CreateExternalShareTargetDto,
  externalShareTargetsCreateAdmin,
  externalShareTargetsFindAllAdmin,
  externalShareTargetsRemoveAdmin,
  externalShareTargetsUpdateAdmin,
} from "@alliance/shared/client";
import {
  rethrowUnlessNotFound,
  thrownRefusalMessage,
} from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { sessionExpiredMessage } from "./sessionExpired";
import { usePatchQueryData } from "./usePatchQueryData";

const externalShareTargetsQuery = queryOptions({
  queryKey: queryKeys.externalShareTargetsAdmin(),
  queryFn: () =>
    externalShareTargetsFindAllAdmin({ throwOnError: true }).then(
      (r) => r.data,
    ),
});

export function useExternalShareTargetsAdmin() {
  return useQuery(externalShareTargetsQuery);
}

export const externalShareTargetsLoadError = (error: unknown) =>
  thrownRefusalMessage({
    error,
    fallback: "Failed to load share targets.",
    sessionExpired: sessionExpiredMessage,
  });

export function useCreateExternalShareTargetAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const setTargets = usePatchQueryData(externalShareTargetsQuery.queryKey);
  return useMutation({
    mutationFn: (body: CreateExternalShareTargetDto) =>
      externalShareTargetsCreateAdmin({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: async (created) => {
      // A refetch that landed before this response may already list it.
      await setTargets((prev) => [
        created,
        ...prev.filter((t) => t.id !== created.id),
      ]);
      onSuccess();
    },
    onError,
  });
}

export function useUpdateExternalShareTargetAdmin(params: {
  onError: (err: Error) => void;
}) {
  const setTargets = usePatchQueryData(externalShareTargetsQuery.queryKey);
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: CreateExternalShareTargetDto;
    }) =>
      externalShareTargetsUpdateAdmin({
        path: { id },
        body: {
          name: values.name.trim(),
          url: values.url.trim(),
          paramName: values.paramName.trim(),
        },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated) =>
      setTargets((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      ),
    onError: params.onError,
  });
}

export function useDeleteExternalShareTargetAdmin(params: {
  onError: (err: Error) => void;
}) {
  const setTargets = usePatchQueryData(externalShareTargetsQuery.queryKey);
  return useMutation({
    mutationFn: (id: number) =>
      externalShareTargetsRemoveAdmin({
        path: { id },
        throwOnError: true,
      }).then(() => undefined, rethrowUnlessNotFound),
    onSuccess: (_data, id) =>
      setTargets((prev) => prev.filter((t) => t.id !== id)),
    onError: params.onError,
  });
}
