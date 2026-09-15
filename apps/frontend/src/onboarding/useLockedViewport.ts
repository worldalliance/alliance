import { useEffect } from "react";

/**
 * Keeps `html` from ever showing a scrollbar while a panel step is on screen,
 * and publishes how much of the viewport the on-screen keyboard is covering.
 * A panel that pads itself by that much keeps its own footer and fields in the
 * part of the page the member can actually see.
 */
export function useLockedViewport(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    root.classList.add("ob-locked");

    const viewport = window.visualViewport;

    const sync = () => {
      const covered = viewport
        ? Math.max(window.innerHeight - viewport.height - viewport.offsetTop, 0)
        : 0;
      root.style.setProperty("--ob-keyboard-inset", `${Math.round(covered)}px`);
      // iOS scrolls the page itself to reveal a focused field rather than
      // shrinking it, which slides the panel out from under the viewport.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);

    return () => {
      root.classList.remove("ob-locked");
      root.style.removeProperty("--ob-keyboard-inset");
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [locked]);
}
