import { useCallback, useEffect, useState, type CSSProperties } from "react";

/** How far the clipped end of a scroller fades over. */
const FADE = "2.75rem";

/**
 * Fades the end of a scroller that has content past it, so a box the member can
 * scroll reads as one rather than as a hard cut. A box that fits gets no fade.
 */
export function useScrollFeather<T extends HTMLElement>() {
  // A callback ref rather than a `useRef`, because a scroller inside a portal
  // mounts on a later commit than the effect and would never be measured.
  const [node, setNode] = useState<T | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    if (!node) return;
    const top = node.scrollTop > 1;
    const bottom = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
    setEdges((previous) =>
      previous.top === top && previous.bottom === bottom
        ? previous
        : { top, bottom },
    );
  }, [node]);

  useEffect(() => {
    if (!node) return;

    // The whole subtree, not the scroller: its own box never changes, and what
    // pushes `scrollHeight` past it is usually a descendant several levels
    // down settling — a graphic sizing itself, an avatar arriving, a webfont.
    const sizes = new ResizeObserver(measure);
    const observed = new WeakSet<Element>();
    const observeAll = () => {
      for (const element of [node, ...node.querySelectorAll("*")]) {
        if (observed.has(element)) continue;
        observed.add(element);
        sizes.observe(element);
      }
    };

    observeAll();
    measure();

    const children = new MutationObserver(() => {
      observeAll();
      measure();
    });
    children.observe(node, { childList: true, subtree: true });
    node.addEventListener("scroll", measure, { passive: true });
    // The entry animation translates its subject down into place, and a
    // translated box counts toward `scrollHeight` while it is still offset.
    node.addEventListener("animationend", measure);
    node.addEventListener("transitionend", measure);

    return () => {
      sizes.disconnect();
      children.disconnect();
      node.removeEventListener("scroll", measure);
      node.removeEventListener("animationend", measure);
      node.removeEventListener("transitionend", measure);
    };
  }, [node, measure]);

  const stops = [
    edges.top ? `transparent 0, #000 ${FADE}` : "#000 0",
    edges.bottom ? `#000 calc(100% - ${FADE}), transparent 100%` : "#000 100%",
  ].join(", ");

  const style: CSSProperties = {
    maskImage: `linear-gradient(to bottom, ${stops})`,
    WebkitMaskImage: `linear-gradient(to bottom, ${stops})`,
  };

  return { ref: setNode, style };
}
