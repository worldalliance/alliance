import { useEffect, useRef, useState } from "react";

/** Stays true for at least `ms` past the moment `active` last went true. */
export function useHeldOn(active: boolean, ms: number): boolean {
  const [held, setHeld] = useState(false);
  const raisedAt = useRef(Date.now());

  useEffect(() => {
    if (active) {
      raisedAt.current = Date.now();
      setHeld(true);
      return;
    }
    const left = raisedAt.current + ms - Date.now();
    if (left <= 0) {
      setHeld(false);
      return;
    }
    const timer = setTimeout(() => setHeld(false), left);
    return () => clearTimeout(timer);
  }, [active, ms]);

  // The raise lands in the render that caused it, which a caller announcing
  // off this depends on.
  return active || held;
}
