import { prefersReducedMotion } from "@alliance/sharedweb/lib/reducedMotion";
import { type RefObject, useEffect, useRef } from "react";

/**
 * Once `open` turns true, scrolls `panel` into view smoothly and focuses
 * `focus`. The list scrolls under the page header that opens the panel, so
 * the panel can mount above the viewport. A panel already open on mount, as
 * on a return to the tab, is left alone.
 */
export function useRevealWhenOpened({
  open,
  panel,
  focus,
}: {
  open: boolean;
  panel: RefObject<HTMLElement | null>;
  focus?: RefObject<HTMLElement | null>;
}) {
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      focus?.current?.focus({ preventScroll: true });
      panel.current?.scrollIntoView?.({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
    wasOpen.current = open;
  }, [open, panel, focus]);
}
