export const TIMED_OUT = Symbol("timed out");

// setTimeout keeps its delay in a signed 32-bit int, so a larger one overflows
// and fires on the next tick, turning the longest deadline into the shortest.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Resolves with whatever `promise` gives, or with {@link TIMED_OUT} once `ms`
 * has passed, whichever comes first. A rejection before the deadline
 * propagates; one after it is dropped. Nothing here cancels `promise`, so a
 * caller that keeps running should treat a {@link TIMED_OUT} as still in
 * flight.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | typeof TIMED_OUT> {
  // setTimeout reads a NaN delay as 0, and a negative one is already past, so
  // a deadline off an unset env var would time out every call at once and read
  // as a slow dependency.
  if (Number.isNaN(ms) || ms < 0) {
    // Nothing subscribes to `promise` on this path, so a later rejection
    // would go unhandled.
    void promise.catch(() => {});
    throw new Error(
      `withTimeout needs a non-negative number of milliseconds, got ${ms}`,
    );
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(
          () => resolve(TIMED_OUT),
          Math.min(ms, MAX_TIMEOUT_MS),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
