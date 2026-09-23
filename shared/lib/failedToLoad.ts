import type { QueryObserverResult } from "@tanstack/react-query";

/** Whether a query failed without ever having data, and stays so while a retry
 * is in flight. `isLoadingError` doesn't: React Query puts a query with no data
 * back to pending when it refetches. */
export const failedToLoad = (
  query: Pick<QueryObserverResult, "data" | "errorUpdateCount">,
): boolean => query.data === undefined && query.errorUpdateCount > 0;
