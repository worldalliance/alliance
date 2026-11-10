import {
  koraBatchesList,
  koraBatchesRandomTranscript,
  koraBatchesUpload,
  type KoraBatchDto,
  type KoraBatchesUploadData,
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

export function useUploadKoraBatch(params: {
  onSuccess: (batch: KoraBatchDto) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KoraBatchesUploadData["body"]) =>
      koraBatchesUpload({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: async (batch) => {
      params.onSuccess(batch);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.koraBatchesAdmin(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.koraProjectAdmin(),
        }),
      ]);
    },
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
