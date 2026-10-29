import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

export function useStoreState<S>(
  storeOf: (queryClient: QueryClient) => {
    subscribe: (listener: () => void) => () => void;
    getState: () => S;
  },
): S {
  const store = storeOf(useQueryClient());
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
