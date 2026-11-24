import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router";

type ConfirmOptions = Parameters<ReturnType<typeof useToast>["confirm"]>[0];
// The page owns the signal; a caller's own would be silently replaced.
type Confirm = (options: Omit<ConfirmOptions, "signal">) => Promise<boolean>;

/**
 * `confirm` that closes, declined, once the path changes or the caller
 * unmounts, and declines a call from an earlier path. A write that follows
 * the route's id must not land on a record staff reached after the question
 * opened.
 */
export function useConfirmOnPage(): Confirm {
  const { confirm } = useToast();
  const { pathname } = useLocation();
  // Built during render, so a question asked in this component's layout
  // effect has a signal. State, not a memo React may drop, which would abort
  // an open question on the same path.
  const [visit, setVisit] = useState(() => ({
    pathname,
    controller: new AbortController(),
  }));
  if (visit.pathname !== pathname) {
    setVisit({ pathname, controller: new AbortController() });
  }
  // A layout cleanup aborts before the next path's layout effects run.
  useLayoutEffect(() => {
    // StrictMode's rehearsal unmount aborted the first controller.
    if (visit.controller.signal.aborted) {
      visit.controller = new AbortController();
    }
    return () => visit.controller.abort();
  }, [visit]);
  return useCallback(
    (options) => confirm({ ...options, signal: visit.controller.signal }),
    [confirm, visit],
  );
}
