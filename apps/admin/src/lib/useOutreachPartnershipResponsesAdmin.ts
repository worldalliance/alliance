import {
  actionPartnershipsCreateNoteAdmin,
  actionPartnershipsDeleteResponseAdmin,
  actionPartnershipsFindAllResponsesAdmin,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { usePatchQueryData } from "./usePatchQueryData";

const outreachPartnershipResponsesQuery = queryOptions({
  queryKey: queryKeys.outreachPartnershipResponsesAdmin(),
  queryFn: () =>
    actionPartnershipsFindAllResponsesAdmin({ throwOnError: true }).then(
      (r) => r.data,
    ),
});

export function useOutreachPartnershipResponsesAdmin() {
  return useQuery(outreachPartnershipResponsesQuery);
}

export function useAddOutreachPartnershipNoteAdmin(params: {
  onSuccess: (responseId: number) => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const setResponses = usePatchQueryData(
    outreachPartnershipResponsesQuery.queryKey,
  );
  return useMutation({
    mutationFn: ({
      responseId,
      body,
      noteDate,
    }: {
      responseId: number;
      body: string;
      noteDate: string | undefined;
    }) =>
      actionPartnershipsCreateNoteAdmin({
        path: { id: responseId },
        body: {
          body,
          ...(noteDate ? { noteDate: new Date(noteDate).toISOString() } : {}),
        },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: async (note, { responseId }) => {
      // A refetch that landed before this response may already list it.
      await setResponses((prev) =>
        prev.map((response) =>
          response.id === responseId
            ? {
                ...response,
                notesHistory: [
                  note,
                  ...response.notesHistory.filter((n) => n.id !== note.id),
                ],
              }
            : response,
        ),
      );
      onSuccess(responseId);
    },
    onError,
  });
}

export function useDeleteOutreachPartnershipResponseAdmin(params: {
  onError: (err: Error) => void;
}) {
  const setResponses = usePatchQueryData(
    outreachPartnershipResponsesQuery.queryKey,
  );
  return useMutation({
    mutationFn: (id: number) =>
      actionPartnershipsDeleteResponseAdmin({
        path: { id },
        throwOnError: true,
      }).then(() => undefined, rethrowUnlessNotFound),
    onSuccess: (_data, id) =>
      setResponses((prev) => prev.filter((response) => response.id !== id)),
    onError: params.onError,
  });
}
