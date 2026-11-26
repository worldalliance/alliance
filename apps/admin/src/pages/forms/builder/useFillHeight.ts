import { useLayoutEffect, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/** The builder's panes need at least this much height to be usable. */
const MIN_HEIGHT = 480;

/**
 * BACKCOMPAT(builder-fill): a height for the builder when its mount gives it
 * none to fill, so its panes scroll and the page doesn't: from its top to the
 * bottom of the window. It applies once the builder grows past the window,
 * which a builder in a filled parent never does. Remove once every mount
 * renders it in a `Page fill`.
 */
export function useFillHeight(
  root: RefObject<HTMLElement | null>,
): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const main = element.closest("main");
      const top = element.getBoundingClientRect().top + (main?.scrollTop ?? 0);
      return Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top));
    };
    if (height !== null) {
      const resize = () => setHeight(measure());
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const overflows = () =>
      element.getBoundingClientRect().bottom > window.innerHeight + 1;
    const check = () => {
      if (!overflows()) return;
      if (import.meta.env.DEV) {
        console.error(
          "FormBuilder: its mount gives it no height to fill. Render it as the only child of a Page fill body.",
        );
      }
      setHeight(measure());
    };
    check();
    // Commits the height before paint, so no frame shows the page overflowing.
    const observer = new ResizeObserver(() => flushSync(check));
    observer.observe(element);
    return () => observer.disconnect();
  }, [height, root]);
  return height;
}
