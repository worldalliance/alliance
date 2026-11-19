import { useEffect } from "react";

let blockers = 0;

/**
 * Keeps automatic restarts off until the returned function runs, while
 * something a restart would lose is under way.
 */
export function blockResumeRestart(): () => void {
  blockers++;
  return () => {
    blockers--;
  };
}

/**
 * Blocks automatic restarts while `active`: set it while a screen or sheet
 * holds unsaved input it keeps only in memory.
 */
export function useBlockResumeRestart(active: boolean): void {
  useEffect(() => (active ? blockResumeRestart() : undefined), [active]);
}

// The focus check covers a screen that holds input without blocking.
export function shouldResumeRestart(params: {
  isUpdatePending: boolean;
  inputFocused: boolean;
}): boolean {
  return params.isUpdatePending && !params.inputFocused && blockers === 0;
}
