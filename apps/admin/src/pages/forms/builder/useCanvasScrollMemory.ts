import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Keeps each view's scroll position in the canvas pane for the session, a
 * view being a page in Edit or Preview, and returns to it when the view is
 * shown again, unless the switch reveals something, which scrolls the pane
 * itself.
 */
export function useCanvasScrollMemory({
  pane,
  view,
  revealing,
}: {
  pane: RefObject<HTMLElement | null>;
  view: string;
  revealing: boolean;
}) {
  const positions = useRef(new Map<string, number>());
  const shown = useRef(view);
  useEffect(() => {
    const element = pane.current;
    if (!element) return;
    const remember = () =>
      positions.current.set(shown.current, element.scrollTop);
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [pane]);
  useLayoutEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    const element = pane.current;
    if (element && !revealing) {
      element.scrollTop = positions.current.get(view) ?? 0;
    }
  }, [view, pane, revealing]);
}
