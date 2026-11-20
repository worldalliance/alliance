/**
 * Wraps `run` so callers that ask while it runs share its promise, which
 * `current` returns, or null while nothing runs.
 */
export function shareInFlight<T>(
  run: () => Promise<T>,
): (() => Promise<T>) & { current: () => Promise<T> | null } {
  let inFlight: Promise<T> | null = null;
  const shared = () => {
    inFlight ??= run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
  return Object.assign(shared, { current: () => inFlight });
}
