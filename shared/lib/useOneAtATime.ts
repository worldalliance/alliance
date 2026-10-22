import { useCallback, useRef, useState } from "react";

/** `run` drops a task handed to it while an earlier one is still running.
 * `busy` is true while one runs. */
export function useOneAtATime() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
