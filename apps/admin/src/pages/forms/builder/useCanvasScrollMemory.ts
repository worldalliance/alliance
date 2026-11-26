import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Keeps each view's scroll position in the canvas pane in `positions`, a view
 * being a page in Edit or Preview, and returns to it once the view has
 * `settled`, unless the switch reveals something, which scrolls the pane
 * itself. `positions` outlives the pane, so leaving the Form tab and coming
 * back finds the page where it was.
 */
export function useCanvasScrollMemory({
  pane,
  view,
  settled,
  revealing,
  positions,
}: {
  pane: RefObject<HTMLElement | null>;
  view: string;
  settled: boolean;
  revealing: boolean;
  positions: Map<string, number>;
}) {
  /** The view the pane's scroll position belongs to; null while one settles. */
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const element = pane.current;
    if (!element) return;
    const remember = () => {
      if (shown.current !== null)
        positions.set(shown.current, element.scrollTop);
    };
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [pane, positions]);
  useLayoutEffect(() => {
    if (shown.current === view) return;
    shown.current = null;
    const element = pane.current;
    if (!settled || !element) return;
    shown.current = view;
    if (!revealing) element.scrollTop = positions.get(view) ?? 0;
  }, [view, settled, pane, revealing, positions]);
}
