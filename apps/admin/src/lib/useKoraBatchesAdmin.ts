import {
  koraBatchesDelete,
  koraBatchesDeletionImpact,
  koraBatchesEvents,
  koraBatchesList,
  koraBatchesRandomTranscript,
  koraBatchesReactivate,
  koraBatchesRetire,
  koraBatchesSetClosesAt,
  koraBatchesUpload,
  koraResultsAssignment,
  type KoraBatchDto,
  type KoraBatchesUploadData,
  type KoraDeletionImpactDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

export function useKoraBatchesAdmin() {
  return useQuery({
    queryKey: queryKeys.koraBatchesAdmin(),
    queryFn: () => koraBatchesList({ throwOnError: true }).then((r) => r.data),
  });
}

function useRefreshBatches() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [
        queryKeys.koraBatchesAdmin(),
        queryKeys.koraBatchEventsAdmin(),
        queryKeys.koraProjectAdmin(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export function useUploadKoraBatch(params: {
  onSuccess: (batch: KoraBatchDto) => void;
}) {
  const refresh = useRefreshBatches();
  return useMutation({
    mutationFn: (body: KoraBatchesUploadData["body"]) =>
      koraBatchesUpload({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: async (batch) => {
      params.onSuccess(batch);
      await refresh();
    },
  });
}

export function useSetKoraBatchClosesAt(params: {
  onSuccess: () => void;
  onError: (error: Error) => void;
}) {
  const refresh = useRefreshBatches();
  return useMutation({
    mutationFn: (input: { batchId: string; closesAt: string }) =>
      koraBatchesSetClosesAt({
        path: { id: input.batchId },
        body: { closesAt: input.closesAt },
        throwOnError: true,
      }),
    onSuccess: async () => {
      params.onSuccess();
      await refresh();
    },
    onError: params.onError,
  });
}

export enum KoraBatchAction {
  Retire = "retire",
  Reactivate = "reactivate",
  Delete = "delete",
}

const BATCH_ACTION: Record<KoraBatchAction, (id: string) => Promise<unknown>> =
  {
    [KoraBatchAction.Retire]: (id) =>
      koraBatchesRetire({ path: { id }, throwOnError: true }),
    [KoraBatchAction.Reactivate]: (id) =>
      koraBatchesReactivate({ path: { id }, throwOnError: true }),
    [KoraBatchAction.Delete]: (id) =>
      koraBatchesDelete({ path: { id }, throwOnError: true }),
  };

export function useKoraBatchAction(params: {
  onSuccess: (action: KoraBatchAction) => void;
  onError: (error: Error) => void;
}) {
  const refresh = useRefreshBatches();
  return useMutation({
    mutationFn: async (input: { action: KoraBatchAction; batchId: string }) => {
      await BATCH_ACTION[input.action](input.batchId);
      return input.action;
    },
    onSuccess: async (action) => {
      params.onSuccess(action);
      await refresh();
    },
    onError: params.onError,
  });
}

export function useKoraDeletionImpact(params: {
  onSuccess: (impact: KoraDeletionImpactDto, batch: KoraBatchDto) => void;
  onError: (error: Error) => void;
}) {
  return useMutation({
    mutationFn: (batch: KoraBatchDto) =>
      koraBatchesDeletionImpact({
        path: { id: batch.id },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: params.onSuccess,
    onError: params.onError,
  });
}

export function useKoraBatchEvents() {
  return useQuery({
    queryKey: queryKeys.koraBatchEventsAdmin(),
    queryFn: () =>
      koraBatchesEvents({ throwOnError: true }).then((r) => r.data),
  });
}

export function useKoraAssignmentExport(assignmentId: string) {
  return useQuery({
    queryKey: queryKeys.koraAssignmentExport(assignmentId),
    queryFn: () =>
      koraResultsAssignment({
        path: { id: assignmentId },
        throwOnError: true,
      }).then((r) => r.data),
  });
}

const rejectedSchema = z.object({
  message: z.string(),
  rejected: z.array(
    z.object({ line: z.number(), problems: z.array(z.string()) }),
  ),
});

export type KoraUploadRejection = z.infer<typeof rejectedSchema>;

/** The lines the server rejected, when that is why the upload failed. */
export const koraUploadRejection = (
  error: unknown,
): KoraUploadRejection | undefined => rejectedSchema.safeParse(error).data;

export function useRandomKoraTranscript(batchId: string) {
  return useQuery({
    queryKey: queryKeys.koraRandomTranscript(batchId),
    queryFn: () =>
      koraBatchesRandomTranscript({
        path: { id: batchId },
        throwOnError: true,
      }).then((r) => r.data),
    gcTime: 0,
    staleTime: 0,
  });
}
