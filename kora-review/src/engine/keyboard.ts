import type { KeyboardCtx } from "./context.js";

export function createKeyboard(ctx: KeyboardCtx) {
  const {
    $,
    MODAL,
    S,
    applyNew,
    clamp,
    clearSel,
    cur,
    doc,
    headBottom,
    introShown,
    keepSelVisible,
    mutate,
    newSelection,
    on,
    openSheet,
    openTranscript,
    overlapping,
    placeHandles,
    plural,
    removeAnn,
    renderSel,
    res,
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
    if (S.screen !== "review" || introShown()) return;
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
    if (S.sheet && MODAL.has(S.sheet.mode)) return;
    const locked = res(cur()).status === "done";
    const k = e.key;
    const onButton = target.closest("button,a,summary");
    if (k === "j" || k === "J") {
      e.preventDefault();
      if (S.idx < S.list.length - 1) openTranscript(S.idx + 1);
      return;
    }
    if (k === "k" || k === "K") {
      e.preventDefault();
      if (S.idx > 0) openTranscript(S.idx - 1);
      return;
    }
    if (locked) return;
    if ((k === "ArrowRight" || k === "ArrowLeft") && !onButton) {
      e.preventDefault();
      moveSel(k === "ArrowRight" ? 1 : -1, e.shiftKey);
      keepSelVisible();
      return;
    }
    if ((k === "+" || k === "=") && S.sel) {
      e.preventDefault();
      applyNew(1);
      return;
    }
    if ((k === "-" || k === "_") && S.sel) {
      e.preventDefault();
      applyNew(-1);
      return;
    }
    if (k === "0" && S.sel && S.noteDraft.trim()) {
      e.preventDefault();
      applyNew(0);
      return;
    }
    if (k === "Enter" && S.sel && !onButton) {
      e.preventDefault();
      const n = $("note");
      if (n) n.focus();
      return;
    }
    if (k === "u" || k === "U") {
      e.preventDefault();
      undo();
      return;
    }
    if (k === "Backspace" || k === "Delete") {
      if (S.editing) {
        e.preventDefault();
        removeAnn(S.editing);
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
            r.annotations = r.annotations.filter((a) => !ids.has(a.id));
          });
          clearSel();
          toast(`Removed ${plural(hits.length, "mark")}`, undo);
        }
      }
    }
  });
  // Focus is never hidden behind the sticky header or the fixed footer: nudge the page so the focused element shows.
  on(rootEl, "focusin", (e) => {
    const el = e.target;
    if (
      !(el instanceof Element) ||
      sheetEl.contains(el) ||
      introShown()?.el.contains(el)
    )
      return;
    if (el.closest(".rhead,.rfoot")) return;
    let kb = true;
    try {
      kb = el.matches(":focus-visible");
    } catch {}
    if (!kb) return;
    const r = el.getBoundingClientRect();
    const top = headBottom() + 8;
    const ft = rootEl.querySelector(".rfoot");
    const bottom =
      Math.min(
        ft && rootEl.classList.contains("has-foot")
          ? ft.getBoundingClientRect().top
          : win.innerHeight,
        S.sheet ? win.innerHeight - sheetEl.offsetHeight : win.innerHeight,
      ) - 8;
    // Only when it's entirely behind the header or footer (WCAG 2.4.11); a tall reply partly in view is left alone.
    if (r.bottom <= top) win.scrollBy(0, r.top - top);
    else if (r.top >= bottom) win.scrollBy(0, r.bottom - bottom);
  });

  on(win, "resize", () => {
    if (S.sel) placeHandles();
  });

  return {};
}
