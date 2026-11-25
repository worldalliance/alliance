/** Input older than this stops the clock: the member has likely walked away. */
export const KORA_IDLE_MS = 2 * 60 * 1000;
export const KORA_REPORT_EVERY_SECONDS = 30;

/** Counts seconds the review was visible and recently used, reporting them in batches. */
export function createActiveTimeCounter(params: {
  report: (seconds: number) => void;
  now: () => number;
}) {
  let lastInput = params.now();
  let unsent = 0;
  const flush = () => {
    if (unsent === 0) return;
    params.report(unsent);
    unsent = 0;
  };
  return {
    input: () => {
      lastInput = params.now();
    },
    /** Call once a second. */
    tick: (visible: boolean) => {
      if (visible && params.now() - lastInput < KORA_IDLE_MS) unsent++;
      if (unsent >= KORA_REPORT_EVERY_SECONDS) flush();
    },
    flush,
  };
}
