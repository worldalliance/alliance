import { useEffect, useState } from "react";

export const SKELETON_DELAY_MS = 200;

/** True once `flag` has stayed true for `delayMs`, so a fast load never flashes a skeleton. */
export function useDelayedFlag(flag: boolean, delayMs = SKELETON_DELAY_MS) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!flag) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [flag, delayMs]);
  return flag && elapsed;
}
