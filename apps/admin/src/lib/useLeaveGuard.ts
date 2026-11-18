import { createContext, useCallback, useContext, useEffect } from "react";
import { useBeforeUnload, type BlockerFunction } from "react-router";

// React Router honours one blocker at a time, so every guard on the page
// registers here and `LeaveGuard` owns the single blocker that asks them all.
const guards = new Set<BlockerFunction>();
let bypassed = false;

export const LeaveGuardContext = createContext(false);

export const anyGuardBlocks: BlockerFunction = (navigation) =>
  !bypassed && [...guards].some((guard) => guard(navigation));

/**
 * Runs a navigation that leaves nothing unsaved behind, such as to a record
 * just saved or created, past every guard. `navigate` must start a push or
 * replace before it returns: a later or history navigation is still asked.
 */
export function withoutLeaveGuard(navigate: () => void) {
  bypassed = true;
  try {
    navigate();
  } finally {
    bypassed = false;
  }
}

/**
 * Asks before a navigation or reload discards unsaved changes. Throws outside
 * `LeaveGuard`, which owns the blocker that asks.
 */
export function useLeaveGuard(
  dirty: boolean,
  options: {
    /** For state that survives a change of search params on the same path. */
    allowSamePath?: boolean;
  } = {},
) {
  if (!useContext(LeaveGuardContext)) {
    throw new Error("useLeaveGuard needs a LeaveGuard above it");
  }
  const { allowSamePath = false } = options;
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
    const guard: BlockerFunction = ({ currentLocation, nextLocation }) =>
      dirty &&
      !(allowSamePath && currentLocation.pathname === nextLocation.pathname);
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  }, [dirty, allowSamePath]);
}
