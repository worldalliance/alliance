import {
  suitePartitionsConvertToPartitionAdmin,
  suitePartitionsPartitionAdmin,
  suitePartitionsPreviewPartitionAdmin,
  suitePartitionsSavePartitionAdmin,
  type PartitionPartDraftDto,
  type SavePartitionResultDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSuitePartition(suiteId: number, isPartitioned: boolean) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.suitePartitionAdmin(suiteId);
  const partition = useQuery({
    queryKey,
    queryFn: () =>
      suitePartitionsPartitionAdmin({
        path: { suiteId },
        throwOnError: true,
      }).then((r) => r.data),
    enabled: isPartitioned,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionSuiteAdmin(suiteId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionSuitesAdmin(),
      }),
    ]);

  const convert = useMutation({
    mutationFn: () =>
      suitePartitionsConvertToPartitionAdmin({
        path: { suiteId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: refresh,
  });

  // A refused save or preview, such as a 409, may mean the stored parts moved on.
  const refetchOnError = () => queryClient.invalidateQueries({ queryKey });

  const save = useMutation({
    mutationFn: async (body: {
      baseVersionId: number;
      parts: PartitionPartDraftDto[];
    }): Promise<SavePartitionResultDto> => {
      const { data: result } = await suitePartitionsSavePartitionAdmin({
        path: { suiteId },
        body,
        throwOnError: true,
      });
      if (result.partition === null) return result;
      // A refetch already running predates the save and would overwrite it.
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, result.partition);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.actionSuiteAdmin(suiteId),
      });
      return result;
    },
    onError: refetchOnError,
  });

  const preview = useMutation({
    mutationFn: (parts: PartitionPartDraftDto[]) =>
      suitePartitionsPreviewPartitionAdmin({
        path: { suiteId },
        body: { parts },
        throwOnError: true,
      }).then((r) => r.data),
    onError: refetchOnError,
  });

  return { partition, convert, save, preview };
}
