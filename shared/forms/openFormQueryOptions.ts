/**
 * Query options for data an open form reads: it holds still while the form
 * is open and loads afresh when the form reopens. A failure reaches the
 * caller. A failed read has no data, so it also loads again on any focus or
 * reconnect refetch the app's query client runs.
 */
export const openFormQueryOptions = {
  staleTime: Infinity,
  gcTime: 0,
  retry: false,
  // A paused offline fetch would never reach the caller as a failure.
  networkMode: "always",
} as const;
