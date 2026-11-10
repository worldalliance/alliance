import {
  koraReviewMore,
  koraReviewSave,
  koraReviewState,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useKoraReview(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.koraReview(),
    queryFn: () =>
      koraReviewState({ throwOnError: true }).then((res) => res.data),
    enabled,
    retry: retryUnlessRefused(1),
    staleTime: Infinity,
  });
  const more = useMutation({
    mutationFn: () =>
      koraReviewMore({ throwOnError: true }).then((res) => res.data),
    onSuccess: (state) =>
      queryClient.setQueryData(queryKeys.koraReview(), state),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.koraReview() });
  return { query, more, refresh };
}

export const saveKoraExport = (
  assignmentId: string,
  exported: Record<string, unknown>,
): Promise<void> =>
  koraReviewSave({
    path: { id: assignmentId },
    body: { export: exported },
    throwOnError: true,
  }).then(() => undefined);
