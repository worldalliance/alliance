import {
  type DataTag,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

export const usePatchQueryData = <T>(queryKey: DataTag<QueryKey, T, Error>) => {
  const patch = usePatchAnyQueryData();
  return (update: (prev: T) => T) => patch(queryKey, update);
};

export const usePatchAnyQueryData = () => {
  const queryClient = useQueryClient();
  return async <T>(
    queryKey: DataTag<QueryKey, T, Error>,
    update: (prev: T) => T,
  ) => {
    // A fetch started before the write would land the old data over it.
    await queryClient.cancelQueries({ queryKey });
    // With no data to patch (the first load was cancelled or failed), a fresh
    // fetch picks up the write.
    if (queryClient.getQueryData(queryKey) === undefined) {
      await queryClient.refetchQueries({ queryKey });
      return;
    }
    queryClient.setQueryData(queryKey, (prev) =>
      prev === undefined ? prev : update(prev),
    );
  };
};

/** Caches a write's result under its key, cancelling any fetch in flight
 * first so it can't land the old data back over the write. */
export const useStoreQueryData = () => {
  const queryClient = useQueryClient();
  return useCallback(
    async (queryKey: QueryKey, saved: unknown) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, saved);
    },
    [queryClient],
  );
};
