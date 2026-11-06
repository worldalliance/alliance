import {
  type QueryClient,
  type QueryKey,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { useStoreState } from "./useStoreState";

/** A list query that caches ids and reads each record from its entity store. */
export function useEntityList<
  S,
  Store extends {
    subscribe: (listener: () => void) => () => void;
    getState: () => S;
  },
  T extends { id: number },
>(params: {
  store: (queryClient: QueryClient) => Store;
  select: (state: S, id: number) => T;
  load: (params: { store: Store; signal: AbortSignal }) => Promise<T[]>;
  queryKey: QueryKey;
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}) {
  const { store, select: selectRecord, load, ...options } = params;
  const queryClient = useQueryClient();
  const state = useStoreState(store);
  const select = useCallback(
    (ids: number[]) => ids.map((id) => selectRecord(state, id)),
    [state, selectRecord],
  );
  return useQuery({
    ...options,
    queryFn: async ({ signal }) =>
      (await load({ store: store(queryClient), signal })).map(({ id }) => id),
    select,
  });
}
