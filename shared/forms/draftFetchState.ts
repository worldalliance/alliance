import { type UseQueryResult } from "@tanstack/react-query";

export type DraftFetchState = {
  /** Set while no fetch runs and the fetch has landed or failed, and while it is off. */
  settled: boolean;
  /** Set from the fetch's first failed attempt, and while it waits offline. */
  failed: boolean;
};

export function draftFetchState(
  query: Pick<
    UseQueryResult,
    "isEnabled" | "fetchStatus" | "isPending" | "failureCount"
  >,
): DraftFetchState {
  return {
    settled:
      !query.isEnabled || (query.fetchStatus === "idle" && !query.isPending),
    failed:
      query.isEnabled &&
      (query.fetchStatus === "paused" || query.failureCount > 0),
  };
}
