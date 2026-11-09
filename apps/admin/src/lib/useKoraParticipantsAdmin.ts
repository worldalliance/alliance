import {
  koraAdminDeleteAbandonedSignup,
  koraAdminDeleteParticipant,
  koraAdminOverview,
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
