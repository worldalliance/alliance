import {
  waitlistAdminFindEntryIdsAdmin,
  waitlistAdminFindEntryMetricsAdmin,
  waitlistAdminInviteEntryAdmin,
  waitlistAdminMarkEntriesNotSpamAdmin,
  waitlistAdminMarkEntriesSpamAdmin,
  waitlistAdminMobilizeEntriesAdmin,
  waitlistAdminRevokeEntryInvitesAdmin,
  waitlistAdminSearchEntriesAdmin,
  waitlistAdminUnmobilizeEntriesAdmin,
  waitlistAdminUnsubscribeEntriesAdmin,
} from "@alliance/shared/client";
import type {
  WaitlistEntryFilterDto,
  WaitlistEntrySearchDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export function useWaitlistEntriesAdmin(search: WaitlistEntrySearchDto) {
  return useQuery({
    queryKey: queryKeys.waitlistEntriesAdmin(search),
    queryFn: () =>
      waitlistAdminSearchEntriesAdmin({
        body: search,
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useWaitlistEntryMetricsAdmin(filter: WaitlistEntryFilterDto) {
  return useQuery({
    queryKey: queryKeys.waitlistEntryMetricsAdmin(filter),
    queryFn: () =>
      waitlistAdminFindEntryMetricsAdmin({
        body: { filter },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useFindWaitlistEntryIdsAdmin(params: {
  onError: (err: Error) => void;
}) {
  return useMutation({
    mutationFn: (filter: WaitlistEntryFilterDto) =>
      waitlistAdminFindEntryIdsAdmin({
        body: { filter },
        throwOnError: true,
      }).then((r) => r.data.ids),
    onError: params.onError,
  });
}

export enum WaitlistEntryChange {
  Mark = "mark",
  Undo = "undo",
  RevokeInvites = "revoke_invites",
  MarkSpam = "mark_spam",
  MarkNotSpam = "mark_not_spam",
}

const SEND_CHANGE: Record<
  WaitlistEntryChange,
  typeof waitlistAdminMobilizeEntriesAdmin
> = {
  [WaitlistEntryChange.Mark]: waitlistAdminMobilizeEntriesAdmin,
  [WaitlistEntryChange.Undo]: waitlistAdminUnmobilizeEntriesAdmin,
  [WaitlistEntryChange.RevokeInvites]: waitlistAdminRevokeEntryInvitesAdmin,
  [WaitlistEntryChange.MarkSpam]: waitlistAdminMarkEntriesSpamAdmin,
  [WaitlistEntryChange.MarkNotSpam]: waitlistAdminMarkEntriesNotSpamAdmin,
};

export function useChangeWaitlistEntriesAdmin(params: {
  onSuccess: (changed: number, kind: WaitlistEntryChange) => void;
  onError: (err: Error, kind: WaitlistEntryChange) => void;
  onSettled: () => void;
}) {
  const { onSuccess, onError, onSettled } = params;
  const invalidateEntries = useInvalidateEntries();
  return useMutation({
    mutationFn: (change: { kind: WaitlistEntryChange; entryIds: number[] }) =>
      SEND_CHANGE[change.kind]({
        body: { entryIds: change.entryIds },
        throwOnError: true,
      }).then((r) => r.data.changed),
    onSuccess: (changed, { kind }) => onSuccess(changed, kind),
    onError: (err, { kind }) => onError(err, kind),
    onSettled: async () => {
      onSettled();
      await invalidateEntries();
    },
  });
}

function useInvalidateEntries() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.waitlistEntriesAdminAll(),
    });
}

export function useInviteWaitlistEntryAdmin(params: {
  onError: (err: Error) => void;
}) {
  const invalidateEntries = useInvalidateEntries();
  return useMutation({
    mutationFn: (entryId: number) =>
      waitlistAdminInviteEntryAdmin({
        path: { id: entryId },
        throwOnError: true,
      }).then((r) => r.data),
    onError: params.onError,
    onSettled: () => {
      void invalidateEntries();
    },
  });
}

export function useUnsubscribeWaitlistEntryAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (entryId: number) =>
      waitlistAdminUnsubscribeEntriesAdmin({
        body: { entryIds: [entryId] },
        throwOnError: true,
      }),
    onSuccess: params.onSuccess,
    onError: params.onError,
    onSettled: async () => {
      params.onSettled();
      await invalidate();
    },
  });
}
