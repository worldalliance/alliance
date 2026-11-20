/**
 * Scrolls only the element's nearest ancestor styled to scroll vertically
 * (computed `overflow-y` auto or scroll), even when that ancestor's content
 * fits, and goes no further; `scrollIntoView` would also scroll every
 * container around it. An ancestor whose `overflow-x` alone is hidden, auto
 * or scroll counts too, since browsers then compute its `overflow-y` as auto.
 * A `<body>` styled to scroll inside a `<html>` left visible hands its
 * overflow to the viewport, so the document scrolls in its place.
 */
export function revealInScroller(element: Element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    const scroller =
      node === document.body &&
      getComputedStyle(document.documentElement).overflowY === "visible"
        ? (document.scrollingElement ?? node)
        : node;
    const box = element.getBoundingClientRect();
    const top =
      scroller === document.scrollingElement
        ? 0
        : scroller.getBoundingClientRect().top + scroller.clientTop;
    const bottom = top + scroller.clientHeight;
    if (box.top < top) scroller.scrollTop -= top - box.top;
    else if (box.bottom > bottom) {
      scroller.scrollTop += Math.min(box.bottom - bottom, box.top - top);
    }
    return;
  }
}
