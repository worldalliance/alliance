import { useEffect } from "react";

/** Keeps `html` from ever showing a scrollbar while a panel step is on screen. */
export function useLockedViewport(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    root.classList.add("ob-locked");
    return () => root.classList.remove("ob-locked");
  }, [locked]);
}
