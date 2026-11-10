import {
  actionSuitesCreateSuiteSplitAdmin,
  actionSuitesDeleteSuiteSplitAdmin,
  actionSuitesSuiteSplitsAdmin,
  actionSuitesUpdateSuiteSplitAdmin,
  type SaveSuiteSplitDto,
  type SuiteSplitDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { parseSuiteSplit } from "@alliance/shared/parsed-dtos";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const suiteSplitsQuery = (suiteId: number) =>
  queryOptions({
    queryKey: queryKeys.suiteSplitsAdmin(suiteId),
    queryFn: () =>
      actionSuitesSuiteSplitsAdmin({
        path: { suiteId },
        throwOnError: true,
      }).then((res) => res.data.map(parseSuiteSplit)),
  });

export function useSuiteSplitsAdmin(suiteId: number) {
  const queryClient = useQueryClient();
  const query = suiteSplitsQuery(suiteId);
  const splits = useQuery(query);

  // Saving a split rewrites its arms' cohort expressions and optional flags.
  const store = async (saved: SuiteSplitDto[]) => {
    await queryClient.cancelQueries({ queryKey: query.queryKey });
    queryClient.setQueryData(query.queryKey, saved.map(parseSuiteSplit));
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionSuiteAdmin(suiteId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.actionAdminAll() }),
    ]);
  };

  const save = useMutation({
    mutationFn: ({
      splitId,
      body,
    }: {
      splitId: number | null;
      body: SaveSuiteSplitDto;
    }) =>
      (splitId === null
        ? actionSuitesCreateSuiteSplitAdmin({
            path: { suiteId },
            body,
            throwOnError: true,
          })
        : actionSuitesUpdateSuiteSplitAdmin({
            path: { suiteId, splitId },
            body,
            throwOnError: true,
          })
      ).then((res) => res.data),
    onSuccess: store,
  });

  const remove = useMutation({
    mutationFn: (splitId: number) =>
      actionSuitesDeleteSuiteSplitAdmin({
        path: { suiteId, splitId },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: store,
  });

  return { splits, save, remove };
}
