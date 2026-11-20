import { withTimeout } from "@alliance/common/timeout";
import { milliseconds } from "date-fns";
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

// React Native's Android HTTP client sets no timeout, so a stalled request
// would otherwise hold restarts off for the rest of the process.
const BLOCK_UNTIL_DEADLINE_MS = milliseconds({ seconds: 30 });

/**
 * Keeps automatic restarts off until `work` settles, or `deadlineMs` passes.
 */
export function blockResumeRestartUntil(
  work: Promise<unknown>,
  deadlineMs = BLOCK_UNTIL_DEADLINE_MS,
): void {
  void withTimeout(Promise.allSettled([work]), deadlineMs).finally(
    blockResumeRestart(),
  );
}

/**
 * Wraps the API client's `fetch` so each request that changes data, which a
 * restart would cut off, keeps automatic restarts off while it is in flight.
 */
export function blockResumeRestartDuringWrites(
  fetch: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return (request) => {
    const response = fetch(request);
    if (request.method !== "GET") blockResumeRestartUntil(response);
    return response;
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
