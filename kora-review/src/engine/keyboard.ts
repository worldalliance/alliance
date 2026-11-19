import type { KeyboardCtx } from "./context.js";

export function createKeyboard(ctx: KeyboardCtx) {
  const {
    S,
    applyNew,
    clamp,
    clearSel,
    doc,
    headBottom,
    keepSelVisible,
    mutate,
    newSelection,
    on,
    focusSheet,
    openSheet,
    overlapping,
    placeHandles,
    plural,
    drop,
    renderSel,
    rootEl,
    selRange,
    sheetEl,
    toast,
    undo,
    win,
  } = ctx;

  /* ---------- Keyboard ---------- */
  function aiMsgs() {
    return Object.keys(S.views)
      .map(Number)
      .sort((a, b) => a - b);
  }
  function moveSel(dir: 1 | -1, extend: boolean) {
    const ms = aiMsgs();
    if (!ms.length) return;
    if (!S.sel) {
      // Start in the focused reply, if any; otherwise the first (or last) one.
      const a = doc.activeElement,
        focused = ms.find((mi) => S.views[mi].bubble === a);
      const mi =
          focused != null ? focused : dir > 0 ? ms[0] : ms[ms.length - 1],
        v = S.views[mi];
      newSelection(mi, dir > 0 ? 0 : v.tokens.length - 1);
    } else {
      const v = S.views[S.sel.mi],
        f = S.sel.focus + dir;
      if (extend) {
        S.sel.focus = clamp(f, 0, v.tokens.length - 1);
        renderSel();
      } else if (f < 0 || f >= v.tokens.length) {
        const i = ms.indexOf(S.sel.mi) + dir;
        if (i < 0 || i >= ms.length) return;
        const nv = S.views[ms[i]];
        newSelection(ms[i], dir > 0 ? 0 : nv.tokens.length - 1);
        nv.bubble.focus({ preventScroll: true });
      } else {
        S.sel = { mi: S.sel.mi, anchor: f, focus: f };
        renderSel();
      }
    }
    S.editing = null;
    openSheet("new", { kb: true });
  }
  on(doc, "keydown", (e) => {
    if (S.screen !== "read") return;
    // Only keys aimed at the tool: focus inside it, or nowhere in particular.
    const target = e.target instanceof Element ? e.target : null;
    if (
      !target ||
      !(
        rootEl.contains(target) ||
        target === doc.body ||
        target === doc.documentElement
      )
    )
      return;
    const typing = target.closest("input,textarea,select");
    if (e.key === "Escape") {
      if (S.sheet || S.sel || S.editing) {
        e.preventDefault();
        clearSel();
      }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) {
      if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      return;
    }
    const k = e.key;
    const onButton = target.closest("button,a,summary");
    if ((k === "ArrowRight" || k === "ArrowLeft") && !onButton) {
      e.preventDefault();
      moveSel(k === "ArrowRight" ? 1 : -1, e.shiftKey);
      keepSelVisible();
      return;
    }
    if ((k === "+" || k === "=") && S.sel) {
      e.preventDefault();
      applyNew("like");
      return;
    }
    if ((k === "-" || k === "_") && S.sel) {
      e.preventDefault();
      applyNew("dislike");
      return;
    }
    if (k === "Enter" && S.sel && !onButton) {
      e.preventDefault();
      focusSheet();
      return;
    }
    if (k === "Backspace" || k === "Delete") {
      if (S.editing) {
        e.preventDefault();
        drop(S.editing);
        return;
      }
      if (S.sel) {
        const v = S.views[S.sel.mi],
          [lo, hi] = selRange();
        const hits = overlapping(
          S.sel.mi,
          v.tokens[lo].start,
          v.tokens[hi].end,
        );
        if (hits.length) {
          e.preventDefault();
          const ids = new Set(hits.map((a) => a.id));
          mutate((r) => {
            r.highlights = r.highlights.filter((x) => !ids.has(x.id));
          });
          clearSel();
          toast(`Removed ${plural(hits.length, "highlight")}`);
        }
      }
    }
  });
  // Focus is never hidden behind the sticky header or the fixed footer: nudge the page so the focused element shows.
  on(rootEl, "focusin", (e) => {
    const el = e.target;
    if (!(el instanceof Element) || sheetEl.contains(el)) return;
    if (el.closest(".rhead")) return;
    let kb = true;
    try {
      kb = el.matches(":focus-visible");
    } catch {}
    if (!kb) return;
    const r = el.getBoundingClientRect();
    const top = headBottom() + 8;
    const bottom =
      (S.sheet ? win.innerHeight - sheetEl.offsetHeight : win.innerHeight) - 8;
    // Only when it's entirely behind the header or the sheet (WCAG 2.4.11); a tall reply partly in view is left alone.
    if (r.bottom <= top) win.scrollBy(0, r.top - top);
    else if (r.top >= bottom) win.scrollBy(0, r.bottom - bottom);
  });

  on(win, "resize", () => {
    if (S.sel) placeHandles();
  });

  return {};
}
