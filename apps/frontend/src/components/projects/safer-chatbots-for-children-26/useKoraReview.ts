import type { KoraNext, KoraSaveResult } from "@alliance/kora-review";
import { parseKoraItem } from "@alliance/kora-review/parse";
import {
  koraReviewHome,
  koraReviewMore,
  koraReviewNext,
  koraReviewOnboarding,
  koraReviewPreferences,
  koraReviewSave,
  koraReviewState,
  type KoraDemographicsDto,
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
  // The tool adds conversations as it goes, so a cached state is stale once the page leaves.
  useEffect(
    () => () => queryClient.removeQueries({ queryKey: queryKeys.koraReview() }),
    [queryClient],
  );
  return { query, more, refresh };
}

export const saveKoraExport = (
  sessionId: string,
  exported: Record<string, unknown>,
): Promise<KoraSaveResult> =>
  koraReviewSave({
    path: { id: sessionId },
    body: { export: exported },
    throwOnError: true,
  }).then((res) => ({ removed: res.data.removed }));

export const nextKoraConversation = (sessionId: string): Promise<KoraNext> =>
  koraReviewNext({ path: { id: sessionId }, throwOnError: true }).then(
    ({ data }) =>
      data.item
        ? { item: parseKoraItem(data.item) }
        : {
            done: data.done === "queue_empty" ? "queue_empty" : "budget_spent",
          },
  );

export const setKoraOnboarding = (body: {
  demographics?: KoraDemographicsDto;
  consented?: true;
  onboarded?: true;
}): Promise<void> =>
  koraReviewOnboarding({ body, throwOnError: true }).then(() => undefined);

export const setKoraPreferences = (body: {
  optOutRisks?: string[];
  extendedOptIn?: boolean;
}): Promise<void> =>
  koraReviewPreferences({ body, throwOnError: true }).then(() => undefined);

export function useKoraHome() {
  return useQuery({
    queryKey: queryKeys.koraHome(),
    queryFn: () =>
      koraReviewHome({ throwOnError: true }).then((res) => res.data),
    retry: retryUnlessRefused(1),
  });
}
