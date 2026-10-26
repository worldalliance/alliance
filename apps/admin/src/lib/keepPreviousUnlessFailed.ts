import type { QueryStatus } from "@tanstack/react-query";

export const keepPreviousUnlessFailed = <T>(
  previous: T | undefined,
  previousQuery: { state: { status: QueryStatus } } | undefined,
): T | undefined =>
  previousQuery?.state.status === "error" ? undefined : previous;
