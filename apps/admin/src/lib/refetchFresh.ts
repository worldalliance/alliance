import { R, type Result } from "@alliance/common/result";
import type {
  QueryObserverResult,
  RefetchOptions,
} from "@tanstack/react-query";
import { fromApi } from "./fromApi";

/**
 * Refetches, failing unless the data was fetched since the call began: a
 * plain refetch resolves with the cached data when the fetch fails or is
 * cancelled.
 */
export const refetchFresh = async <T>(
  refetch: (options: RefetchOptions) => Promise<QueryObserverResult<T>>,
): Promise<Result<T, unknown>> => {
  const startedAt = Date.now();
  const reload = await fromApi(refetch({ throwOnError: true }));
  if (!reload.ok) return reload;
  const { data, dataUpdatedAt } = reload.value;
  if (data === undefined) {
    return R.failure(new Error("The reload returned nothing."));
  }
  if (dataUpdatedAt < startedAt) {
    return R.failure(new Error("The reload was cancelled before it returned."));
  }
  return R.success(data);
};
