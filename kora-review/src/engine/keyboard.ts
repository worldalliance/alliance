import type { KeyboardCtx } from "./context.js";

export function createKeyboard(ctx: KeyboardCtx) {
  const { introShown, on, rootEl, win } = ctx;

  const headBottom = () => {
    const hd = rootEl.querySelector(".rhead");
    return hd ? hd.getBoundingClientRect().bottom : 0;
  };
  // Focus is never hidden behind the sticky header: nudge the page so the focused element shows.
  on(rootEl, "focusin", (e) => {
    const el = e.target;
    if (!(el instanceof Element) || introShown()?.el.contains(el)) return;
    if (el.closest(".rhead,.react-picker")) return;
    let kb = true;
    try {
      kb = el.matches(":focus-visible");
    } catch {}
    if (!kb) return;
    const r = el.getBoundingClientRect();
    const top = headBottom() + 8,
      bottom = win.innerHeight - 8;
    // Only when it's entirely behind the header or below the window (WCAG 2.4.11); a tall reply partly in view is left alone.
    if (r.bottom <= top) win.scrollBy(0, r.top - top);
    else if (r.top >= bottom) win.scrollBy(0, r.bottom - bottom);
  });

  return {};
}
