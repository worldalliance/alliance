import { useCallback, useEffect, useRef, type RefObject } from "react";
import { focusInPlace } from "../../pages/forms/builder/kit/revealInPane";

/**
 * Returns a function that focuses `region`, or what `within` picks inside it,
 * if the element focused inside it went away, leaving focus on the page.
 */
export function useRestoreFocusWithin(
  region: RefObject<HTMLElement | null>,
  within?: (region: HTMLElement) => HTMLElement | null,
) {
  const focused = useRef<Element | null>(null);
  useEffect(() => {
    const track = (event: FocusEvent) => {
      focused.current =
        event.target instanceof Element &&
        region.current?.contains(event.target)
          ? event.target
          : null;
    };
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, [region]);
  return useCallback(() => {
    if (focused.current?.isConnected !== false) return;
    focused.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const root = region.current;
    if (root) focusInPlace(within?.(root) ?? root);
  }, [region, within]);
}
