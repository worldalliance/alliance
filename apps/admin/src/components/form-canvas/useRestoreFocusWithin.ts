import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Returns a function that focuses `region` if the element focused inside it
 * went away, leaving focus on the page.
 */
export function useRestoreFocusWithin(region: RefObject<HTMLElement | null>) {
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
    if (!active || active === document.body) region.current?.focus();
  }, [region]);
}
