import {
  suiteSplitsConvertToSplitAdmin,
  suiteSplitsPreviewSplitAdmin,
  suiteSplitsSaveSplitAdmin,
  suiteSplitsSplitAdmin,
  type SaveSplitResultDto,
  type SplitGroupDraftDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSuiteSplit(suiteId: number, usesGroups: boolean) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.suiteSplitAdmin(suiteId);
  const split = useQuery({
    queryKey,
    queryFn: () =>
      suiteSplitsSplitAdmin({ path: { suiteId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    enabled: usesGroups,
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
      suiteSplitsConvertToSplitAdmin({
        path: { suiteId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: refresh,
  });

  // A refused save or preview, such as a 409, may mean the stored groups moved on.
  const refetchOnError = () => queryClient.invalidateQueries({ queryKey });

  const save = useMutation({
    mutationFn: async (body: {
      baseVersionId: number;
      groups: SplitGroupDraftDto[];
    }): Promise<SaveSplitResultDto> => {
      const { data: result } = await suiteSplitsSaveSplitAdmin({
        path: { suiteId },
        body,
        throwOnError: true,
      });
      if (result.split === null) return result;
      // A refetch already running predates the save and would overwrite it.
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, result.split);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.actionSuiteAdmin(suiteId),
      });
      return result;
    },
    onError: refetchOnError,
  });

  const preview = useMutation({
    mutationFn: (groups: SplitGroupDraftDto[]) =>
      suiteSplitsPreviewSplitAdmin({
        path: { suiteId },
        body: { groups },
        throwOnError: true,
      }).then((r) => r.data),
    onError: refetchOnError,
  });

  return { split, convert, save, preview };
}
