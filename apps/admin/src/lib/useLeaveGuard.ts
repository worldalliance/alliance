import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useBeforeUnload, type BlockerFunction } from "react-router";

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
export function useLeaveGuard(dirty: boolean) {
  const guards = useContext(LeaveGuardContext);
  if (!guards) {
    throw new Error("useLeaveGuard needs a LeaveGuard above it");
  }
  const bypassed = useRef(false);
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
    const guard: BlockerFunction = () => dirty && !bypassed.current;
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  }, [guards, dirty]);

  return useCallback((navigate: () => void) => {
    bypassed.current = true;
    try {
      navigate();
    } finally {
      bypassed.current = false;
    }
  }, []);
}
