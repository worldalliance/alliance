import {
  waitlistEmailAdminFindEmailAdmin,
  waitlistEmailAdminFindEmailsAdmin,
  waitlistEmailAdminPreviewEmailAdmin,
  waitlistEmailAdminRetryEmailAdmin,
  waitlistEmailAdminSendEmailAdmin,
  waitlistEmailAdminSendTestEmailAdmin,
} from "@alliance/shared/client";
import type {
  PreviewWaitlistEmailDto,
  SendWaitlistEmailDto,
  TestWaitlistEmailDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { inProgress, SENDING_POLL_MS } from "./waitlistEmail";

export function useWaitlistEmailsAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistEmailsAdmin(),
    queryFn: () =>
      waitlistEmailAdminFindEmailsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    refetchInterval: (query) =>
      query.state.data?.some(inProgress) ? SENDING_POLL_MS : false,
  });
}

export function useWaitlistEmailAdmin(id: number) {
  return useQuery({
    queryKey: queryKeys.waitlistEmailAdmin(id),
    queryFn: () =>
      waitlistEmailAdminFindEmailAdmin({
        path: { id },
        throwOnError: true,
      }).then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data)
        ? SENDING_POLL_MS
        : false,
  });
}

export function useWaitlistEmailPreviewAdmin(
  preview: PreviewWaitlistEmailDto,
  options: { enabled: boolean },
) {
  return useQuery({
    queryKey: queryKeys.waitlistEmailPreviewAdmin(preview),
    queryFn: () =>
      waitlistEmailAdminPreviewEmailAdmin({
        body: preview,
        throwOnError: true,
      }).then((r) => r.data),
    enabled: options.enabled,
    placeholderData: keepPreviousData,
  });
}

/** Refreshes one email's detail and the list its counts appear in. */
function useInvalidateWaitlistEmailAdmin(id: number): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistEmailAdmin(id),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistEmailsAdmin(),
      }),
    ]);
  }, [queryClient, id]);
}

export function useSendTestWaitlistEmailAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  return useMutation({
    mutationFn: (email: TestWaitlistEmailDto) =>
      waitlistEmailAdminSendTestEmailAdmin({ body: email, throwOnError: true }),
    onSuccess: params.onSuccess,
    onError: params.onError,
    onSettled: params.onSettled,
  });
}

/** `recipients` is the count the sender confirmed, passed back to `onSuccess`. */
export function useSendWaitlistEmailAdmin(params: {
  onSuccess: (recipients: number) => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onSuccess, onError, onSettled } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
    }: {
      email: SendWaitlistEmailDto;
      recipients: number;
    }) =>
      waitlistEmailAdminSendEmailAdmin({
        body: email,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (_batch, { recipients }) => onSuccess(recipients),
    onError,
    onSettled: async () => {
      onSettled();
      // A failed send may still have created its batch, which the preview's
      // repeat-send count has to include.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.waitlistEntriesAdminAll(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.waitlistEmailPreviewAdminAll(),
        }),
      ]);
    },
  });
}

export function useRetryWaitlistEmailAdmin(
  id: number,
  params: {
    onSuccess: () => void;
    onError: (err: Error) => void;
    onSettled: () => void;
  },
) {
  const { onSuccess, onError, onSettled } = params;
  const invalidate = useInvalidateWaitlistEmailAdmin(id);
  return useMutation({
    mutationFn: (includeUncertain: boolean) =>
      waitlistEmailAdminRetryEmailAdmin({
        path: { id },
        body: { includeUncertain },
        throwOnError: true,
      }),
    onSuccess,
    onError,
    onSettled: async () => {
      onSettled();
      await invalidate();
    },
  });
}
