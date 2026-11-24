import { KoraReviewPhase } from "@alliance/common/kora";
import type {
  KoraAssignedTranscript,
  KoraSaveResult,
} from "@alliance/kora-review";
import { parseKoraTranscript } from "@alliance/kora-review/parse";
import {
  koraActionReviewState,
  koraReviewHome,
  koraReviewMore,
  koraReviewNext,
  koraReviewSave,
  koraReviewState,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

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
  // The tool adds pairs as it goes, so a cached state is stale once the page leaves.
  useEffect(
    () => () => queryClient.removeQueries({ queryKey: queryKeys.koraReview() }),
    [queryClient],
  );
  return { query, more, refresh };
}

export const saveKoraExport = (
  assignmentId: string,
  exported: Record<string, unknown>,
): Promise<KoraSaveResult> =>
  koraReviewSave({
    path: { id: assignmentId },
    body: { export: exported },
    throwOnError: true,
  }).then((res) => ({ removed: res.data.removed }));

export const nextKoraTranscript = (
  assignmentId: string,
): Promise<KoraAssignedTranscript | null> =>
  koraReviewNext({ path: { id: assignmentId }, throwOnError: true }).then(
    ({ data: { next } }) =>
      next && {
        transcript: parseKoraTranscript(next.transcript),
        contentHash: next.contentHash,
      },
  );

export function useKoraHome() {
  return useQuery({
    queryKey: queryKeys.koraHome(),
    queryFn: () =>
      koraReviewHome({ throwOnError: true }).then((res) => res.data),
    retry: retryUnlessRefused(1),
  });
}

/** A Kora review action's own assignment; the server completes the action when it finishes or finds nothing to review. */
export function useKoraActionReview(actionId: number, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.koraActionReview(actionId),
    queryFn: async () => {
      const { data } = await koraActionReviewState({
        path: { id: actionId },
        throwOnError: true,
      });
      if (data.phase !== KoraReviewPhase.Reviewing) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.action(actionId),
        });
      }
      return data;
    },
    enabled,
    retry: retryUnlessRefused(1),
    staleTime: Infinity,
  });
}
