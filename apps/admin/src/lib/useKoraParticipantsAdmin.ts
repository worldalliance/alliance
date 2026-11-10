import type { KoraProjectStatus } from "@alliance/common/kora";
import {
  koraAdminDeleteAbandonedSignup,
  koraAdminDeleteParticipant,
  koraAdminNotifyMore,
  koraAdminNotifyWaitlist,
  koraAdminOverview,
  koraAdminProject,
  koraAdminUpdateProject,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useKoraParticipantsAdmin() {
  return useQuery({
    queryKey: queryKeys.koraParticipantsAdmin(),
    queryFn: () =>
      koraAdminOverview({ throwOnError: true }).then((r) => r.data),
  });
}

export enum KoraRecordKind {
  Participant = "participant",
  AbandonedSignup = "abandonedSignup",
}

const DELETE: Record<KoraRecordKind, (id: string) => Promise<unknown>> = {
  [KoraRecordKind.Participant]: (id) =>
    koraAdminDeleteParticipant({ path: { id }, throwOnError: true }).catch(
      rethrowUnlessNotFound,
    ),
  [KoraRecordKind.AbandonedSignup]: (id) =>
    koraAdminDeleteAbandonedSignup({ path: { id }, throwOnError: true }).catch(
      rethrowUnlessNotFound,
    ),
};

export function useDeleteKoraRecordAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (record: { kind: KoraRecordKind; id: string }) =>
      DELETE[record.kind](record.id),
    onSuccess: params.onSuccess,
    onError: params.onError,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.koraParticipantsAdmin(),
      }),
  });
}

export function useKoraProjectAdmin() {
  return useQuery({
    queryKey: queryKeys.koraProjectAdmin(),
    queryFn: () => koraAdminProject({ throwOnError: true }).then((r) => r.data),
  });
}

export function useSetKoraProjectStatus(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: KoraProjectStatus) =>
      koraAdminUpdateProject({ body: { status }, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.koraProjectAdmin(), project);
      params.onSuccess();
    },
    onError: params.onError,
  });
}

export enum KoraNoticeKind {
  Launch = "launch",
  More = "more",
}

const SEND_NOTICE: Record<KoraNoticeKind, () => Promise<{ queued: number }>> = {
  [KoraNoticeKind.Launch]: () =>
    koraAdminNotifyWaitlist({ throwOnError: true }).then((r) => r.data),
  [KoraNoticeKind.More]: () =>
    koraAdminNotifyMore({ throwOnError: true }).then((r) => r.data),
};

export function useSendKoraNotice(params: {
  notice: KoraNoticeKind;
  onSuccess: (queued: number) => void;
  onError: (err: Error) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: SEND_NOTICE[params.notice],
    onSuccess: ({ queued }) => params.onSuccess(queued),
    onError: params.onError,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.koraProjectAdmin(),
      }),
  });
}
