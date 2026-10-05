import {
  type CreateWaitlistCohortDto,
  waitlistAdminCreateCohortAdmin,
  waitlistAdminDeleteCohortAdmin,
  waitlistAdminFindCohortsAdmin,
  waitlistAdminUpdateCohortAdmin,
  type WaitlistCohortDto,
  type WaitlistEntryFilterDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useListCache } from "./useListCache";

export function useWaitlistCohortsAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistCohortsAdmin(),
    queryFn: () =>
      waitlistAdminFindCohortsAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

const useCohortsCache = () =>
  useListCache<WaitlistCohortDto>(queryKeys.waitlistCohortsAdmin());

export function useCreateWaitlistCohortAdmin(params: {
  onSuccess: (created: WaitlistCohortDto) => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const cache = useCohortsCache();
  return useMutation({
    mutationFn: (body: CreateWaitlistCohortDto) =>
      waitlistAdminCreateCohortAdmin({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: (created) => {
      cache.update((old) => [...old, created]);
      onSuccess(created);
    },
    onError,
    onSettled: cache.invalidate,
  });
}

export function useUpdateWaitlistCohortAdmin(params: {
  onSuccess: (updated: WaitlistCohortDto) => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onSuccess, onError, onSettled } = params;
  const cache = useCohortsCache();
  return useMutation({
    mutationFn: ({
      id,
      filter,
    }: {
      id: number;
      filter: WaitlistEntryFilterDto;
    }) =>
      waitlistAdminUpdateCohortAdmin({
        path: { id },
        body: { filter },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated) => {
      cache.update((old) =>
        old.map((c) => (c.id === updated.id ? updated : c)),
      );
      onSuccess(updated);
    },
    onError,
    onSettled: async () => {
      onSettled();
      await cache.invalidate();
    },
  });
}

export function useDeleteWaitlistCohortAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onSuccess, onError, onSettled } = params;
  const cache = useCohortsCache();
  return useMutation({
    mutationFn: (id: number) =>
      waitlistAdminDeleteCohortAdmin({ path: { id }, throwOnError: true }),
    onSuccess: (_, id) => {
      cache.update((old) => old.filter((c) => c.id !== id));
      onSuccess();
    },
    onError,
    onSettled: async () => {
      onSettled();
      await cache.invalidate();
    },
  });
}
