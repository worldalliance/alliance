import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import {
  type FetchQueryOptions,
  QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { milliseconds } from "date-fns";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: milliseconds({ days: 1 }),
      retry: retryUnlessRefused(3),
    },
  },
});

/** The `staleTime` of a query `prefetchFromLoader` starts: long enough that
 * the page mounting just after the loader doesn't load it again. */
export const loaderPrefetchStaleTime = milliseconds({ seconds: 10 });

/** Starts a query from a route loader, fetching even over fresh data. */
export function prefetchFromLoader<T, TKey extends QueryKey>(
  options: FetchQueryOptions<T, Error, T, TKey>,
) {
  void queryClient.prefetchQuery({ ...options, staleTime: 0 });
}
