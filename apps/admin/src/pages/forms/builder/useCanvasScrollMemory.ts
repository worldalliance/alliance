import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Keeps each page's scroll position in the canvas pane for the session, and
 * returns to it when the page is shown again, unless the switch reveals
 * something, which scrolls the pane itself.
 */
export function useCanvasScrollMemory({
  pane,
  pageId,
  revealing,
}: {
  pane: RefObject<HTMLElement | null>;
  pageId: string;
  revealing: boolean;
}) {
  const positions = useRef(new Map<string, number>());
  const shown = useRef(pageId);
  useEffect(() => {
    const element = pane.current;
    if (!element) return;
    const remember = () =>
      positions.current.set(shown.current, element.scrollTop);
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [pane]);
  useLayoutEffect(() => {
    if (shown.current === pageId) return;
    shown.current = pageId;
    const element = pane.current;
    if (element && !revealing) {
      element.scrollTop = positions.current.get(pageId) ?? 0;
    }
  }, [pageId, pane, revealing]);
}
