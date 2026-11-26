/**
 * Scrolls `pane`, and only `pane`, the least distance that shows `target`
 * whole with `margin` px to spare, or its top when it is taller than the
 * pane. Does nothing when it is already in view. The scroll is animated, so
 * the reader sees where it went, unless they asked for reduced motion.
 */
export function revealInPane(
  pane: HTMLElement,
  target: HTMLElement,
  margin = 24,
): void {
  const view = pane.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const top = box.top - view.top;
  const bottom = box.bottom - view.top;
  if (top >= 0 && bottom <= view.height) return;
  const fits = box.height + 2 * margin <= view.height;
  const delta = top < 0 || !fits ? top - margin : bottom - view.height + margin;
  pane.scrollTo({ top: pane.scrollTop + delta, behavior: scrollBehavior() });
}

export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";

/** The only way the builder moves focus: it never scrolls anything. */
export function focusInPlace(el: HTMLElement | null | undefined): void {
  el?.focus({ preventScroll: true });
}
