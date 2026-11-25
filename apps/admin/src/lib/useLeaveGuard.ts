import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  useBeforeUnload,
  useLocation,
  type BlockerFunction,
} from "react-router";

// React Router honours one blocker at a time, so guards register in the set
// their `LeaveGuard` provides, and it owns the single blocker that asks them all.
export const LeaveGuardContext = createContext<Set<BlockerFunction> | null>(
  null,
);

/**
 * Asks before a navigation or reload discards unsaved changes. Throws outside
 * `LeaveGuard`, which owns the blocker that asks.
 *
 * Returns a function that runs a navigation leaving nothing of this guard's
 * unsaved, such as to a record just saved, past this guard alone: other
 * guards still ask. Its `navigate` must start a push or replace before it
 * returns; a later or history navigation is still asked.
 */
export function useLeaveGuard(
  dirty: boolean,
  options: {
    /** For state that survives a change of search params on the same path. */
    allowSamePath?: boolean;
  } = {},
) {
  const guards = useContext(LeaveGuardContext);
  if (!guards) {
    throw new Error("useLeaveGuard needs a LeaveGuard above it");
  }
  const { allowSamePath = false } = options;
  const bypassed = useRef(false);
  const departedTo = useRef<string>(undefined);
  const { key } = useLocation();
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [dirty],
    ),
  );

  useEffect(() => {
    // A page its own unprompted navigation has left keeps its guard until its
    // effects clean up, so the guard stands down once the router reaches that
    // navigation's destination. A page that stays mounted through another
    // navigation, or whose navigation another guard blocked, still guards.
    const guard: BlockerFunction = ({ currentLocation, nextLocation }) => {
      if (bypassed.current) {
        departedTo.current = nextLocation.key;
        return false;
      }
      return (
        dirty &&
        !(
          departedTo.current === currentLocation.key &&
          currentLocation.key !== key
        ) &&
        !(allowSamePath && currentLocation.pathname === nextLocation.pathname)
      );
    };
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  }, [guards, dirty, allowSamePath, key]);

  return useCallback((navigate: () => void) => {
    bypassed.current = true;
    departedTo.current = undefined;
    try {
      navigate();
    } finally {
      bypassed.current = false;
    }
  }, []);
}
