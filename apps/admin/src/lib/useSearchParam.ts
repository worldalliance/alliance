import { useCallback, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router";

// The last update not yet rendered, and the location it was made on.
// react-router hands `setSearchParams`' updater the params from the last
// render, so a second update before the first renders would undo it; it builds
// on this one instead. When the leave guard refuses a navigation, only the
// navigation still in flight will land, so pending goes back to its update.
// Other writers of the search params record nothing here, so a page mixing
// them with this hook loses their updates made before the next render.
type Pending = {
  from: string;
  pathname: string;
  to: string;
  previous: Pending | null;
};
let pending: Pending | null = null;
// Hooks mounted per location key. Back returns to an entry's key, so leaving a
// page drops its pending update, but only once its last hook unmounts, since
// the page's other hooks still build on it.
const mountedAt = new Map<string, number>();

/** For the navigation blocker, on refusing: keeps only the update in flight. */
export function dropPendingSearchParams(
  inFlight: { pathname: string; search: string } | undefined,
) {
  const search = inFlight && new URLSearchParams(inFlight.search).toString();
  while (
    pending &&
    !(pending.pathname === inFlight?.pathname && pending.to === search)
  ) {
    pending = pending.previous;
  }
}

/** One search param as state; `null` removes it. Updates replace the history entry. */
export function useSearchParam(
  key: string,
): [string | null, (value: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { key: locationKey, pathname } = useLocation();
  useEffect(() => {
    mountedAt.set(locationKey, (mountedAt.get(locationKey) ?? 0) + 1);
    return () => {
      const left = (mountedAt.get(locationKey) ?? 1) - 1;
      if (left > 0) {
        mountedAt.set(locationKey, left);
        return;
      }
      mountedAt.delete(locationKey);
      if (pending?.from === locationKey) pending = null;
    };
  }, [locationKey]);
  const set = useCallback(
    (value: string | null) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(
            pending?.from === locationKey ? pending.to : prev,
          );
          if (value === null) next.delete(key);
          else next.set(key, value);
          pending = {
            from: locationKey,
            pathname,
            to: next.toString(),
            previous: pending?.from === locationKey ? pending : null,
          };
          return next;
        },
        { replace: true },
      ),
    [key, locationKey, pathname, setSearchParams],
  );
  return [searchParams.get(key), set];
}
