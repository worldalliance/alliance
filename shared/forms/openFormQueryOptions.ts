/**
 * Query options for data an open form reads: it holds still while the form
 * is open and loads afresh when the form reopens. A failure shows the form's
 * retry control, and only that control reloads it.
 */
export const openFormQueryOptions = {
  staleTime: Infinity,
  gcTime: 0,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  // A paused offline fetch would hold the form on loading; failing shows retry.
  networkMode: "always",
} as const;
