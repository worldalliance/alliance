import {
  type DataTag,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";

export const usePatchQueryData = <T>(queryKey: DataTag<QueryKey, T, Error>) => {
  const queryClient = useQueryClient();
  return async (update: (prev: T) => T) => {
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
