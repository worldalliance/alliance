import type { Late, SelectionCtx } from "./context.js";
import type { TimerId } from "./runtime.js";

type Pointer = {
  mi: number;
  id: number;
  lastX: number;
  lastY: number;
  raf?: number | TimerId;
};
/** A press on a word: a tap, or a sweep once it moves or is held. */
type Press = Pointer & {
  handle?: undefined;
  dy?: undefined;
  t: number;
  x: number;
  y: number;
  mouse: boolean;
  moved: boolean;
  sweeping: boolean;
  timer: TimerId | null;
};
type HandleDrag = Pointer & {
  handle: "start" | "end";
  dy: number;
  sweeping?: undefined;
  timer?: undefined;
};

const targetEl = (e: Event) =>
  e.target instanceof Element ? e.target : null;

export function createSelection(ctx: SelectionCtx) {
  const {
    $$,
    S,
    cancel,
    clamp,
    commitNote,
    isDestroyed,
    doc,
    h,
    later,
    nudgeChoice,
    on,
    openEdit,
    raf,
    renderAnns,
    rootEl,
    sheetEl,
    win,
  } = ctx;
  const closeSheet: Late["closeSheet"] = (...args) => ctx.late().closeSheet(...args);
  const openSheet: Late["openSheet"] = (...args) => ctx.late().openSheet(...args);

  /* ---------- Selection ---------- */
  function selRange(): [number, number] {
    if (!S.sel) throw new Error("no selection");
    const { anchor: a, focus: f } = S.sel;
    return [Math.min(a, f), Math.max(a, f)];
  }
  function renderSel() {
    $$(".tk.sel,.gap.sel").forEach((e) => e.classList.remove("sel"));
    if (!S.sel) {
      removeHandles();
      return;
    }
    const v = S.views[S.sel.mi],
      [lo, hi] = selRange();
    for (let k = lo; k <= hi; k++) {
      v.tokens[k].el.classList.add("sel");
      if (k < hi) (v.gaps[k] || []).forEach((g) => g.classList.add("sel"));
    }
    placeHandles();
  }
  function removeHandles() {
    $$(".handle").forEach((e) => e.remove());
  }
  function placeHandles() {
    if (!S.sel) return;
    const v = S.views[S.sel.mi],
      [lo, hi] = selRange(),
      bub = v.bubble;
    $$(".handle").forEach((e) => {
      if (e.parentNode !== bub) e.remove();
    });
    const br = bub.getBoundingClientRect();
    const a = v.tokens[lo].el.getClientRects()[0],
      bRects = v.tokens[hi].el.getClientRects(),
      b = bRects[bRects.length - 1];
    if (!a || !b) return;
    const put = (cls: "start" | "end", x: number, y: number, ht: number) => {
      let el = bub.querySelector<HTMLElement>(".handle." + cls);
      if (!el) {
        el = h("span", { class: "handle " + cls, "aria-hidden": "true" });
        el.addEventListener("pointerdown", (e) => onHandleDown(e, cls));
        bub.append(el);
      }
      el.style.left = x - br.left - bub.clientLeft + "px";
      el.style.top = y - br.top - bub.clientTop + "px";
      el.style.height = ht + "px";
    };
    put("start", a.left, a.top, a.height);
    put("end", b.right, b.top, b.height);
  }
  function clearSel() {
    if (S.editing && S.sheet && S.sheet.mode === "edit") commitNote(S.editing);
    S.sel = null;
    S.editing = null;
    S.noteDraft = "";
    renderSel();
    renderAnns();
    closeSheet();
  }
  function newSelection(mi: number, t: number) {
    S.editing = null;
    S.noteDraft = "";
    S.sel = { mi, anchor: t, focus: t };
    $$(".tk.pulse").forEach((e) => e.classList.remove("pulse"));
    renderAnns();
    renderSel();
  }
  function annAtToken(mi: number, t: number) {
    const v = S.views[mi];
    return v && v.tokens[t] ? v.tokens[t].ann : null;
  }
  // While a selection is open it can be stretched or moved; only +1, −1, a note, ✕ or Escape closes it.
  function onTap(mi: number, t: number) {
    if (S.sel) {
      if (S.sel.mi === mi) {
        const [lo, hi] = selRange();
        if (t < lo || t > hi) {
          S.sel = { mi, anchor: t < lo ? hi : lo, focus: t };
          renderSel();
          openSheet("new");
          return;
        }
        if (lo === hi && t === lo) return;
      }
      const draft = S.noteDraft;
      newSelection(mi, t);
      S.noteDraft = draft;
      openSheet("new");
      return;
    }
    const a = annAtToken(mi, t);
    if (a) {
      openEdit(a.id);
      return;
    }
    newSelection(mi, t);
    openSheet("new");
  }

  /* ---------- Pointer gestures: tap, long-press sweep, handle drag ---------- */
  let G: Press | HandleDrag | null = null;
  on(doc, "pointerdown", (e) => {
    if (S.screen !== "review" || e.button > 0) return;
    const tk = targetEl(e)?.closest<HTMLElement>(".layer:not(.locked) .tk");
    if (!tk || !rootEl.contains(tk)) return;
    const mi = Number(tk.dataset.m),
      t = Number(tk.dataset.t);
    const press: Press = {
      mi,
      t,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      mouse: e.pointerType === "mouse",
      moved: false,
      sweeping: false,
      timer: null,
    };
    G = press;
    if (press.mouse) e.preventDefault();
    else
      press.timer = later(() => {
        if (G === press && !press.moved) {
          press.sweeping = true;
          startSweep(press);
          if (navigator.vibrate)
            try {
              navigator.vibrate(8);
            } catch {}
        }
      }, 350);
  });
  on(doc, "pointermove", (e) => {
    if (!G || e.pointerId !== G.id) return;
    G.lastX = e.clientX;
    G.lastY = e.clientY;
    if (G.handle || G.sweeping) {
      updateDrag();
      return;
    }
    if (Math.hypot(e.clientX - G.x, e.clientY - G.y) > 8) {
      if (G.mouse) {
        G.sweeping = true;
        startSweep(G);
        updateDrag();
      } else {
        G.moved = true;
        cancel(G.timer);
      }
    }
  });
  on(doc, "pointerup", (e) => {
    if (!G || e.pointerId !== G.id) return;
    const g = G;
    cancel(g.timer);
    G = null;
    if (g.handle || g.sweeping) {
      endDrag();
      return;
    }
    if (!g.moved) onTap(g.mi, g.t);
  });
  on(doc, "pointercancel", (e) => {
    if (!G || e.pointerId !== G.id) return;
    const g = G;
    cancel(g.timer);
    G = null;
    if (g.handle || g.sweeping) endDrag();
  });
  on(
    doc,
    "touchmove",
    (e) => {
      if (G && (G.sweeping || G.handle)) e.preventDefault();
    },
    { passive: false },
  );
  function startSweep(g: Press) {
    if (!(S.sel && S.sel.mi === g.mi)) newSelection(g.mi, g.t);
    else {
      S.sel = { mi: g.mi, anchor: g.t, focus: g.t };
      renderSel();
    }
    beginDragUI(g);
  }
  function onHandleDown(e: PointerEvent, which: "start" | "end") {
    if (!S.sel) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      targetEl(e)?.releasePointerCapture(e.pointerId);
    } catch {}
    const [lo, hi] = selRange();
    S.sel = {
      mi: S.sel.mi,
      anchor: which === "start" ? hi : lo,
      focus: which === "start" ? lo : hi,
    };
    const r = S.views[S.sel.mi].tokens[S.sel.focus].el.getBoundingClientRect();
    const drag: HandleDrag = {
      handle: which,
      mi: S.sel.mi,
      id: e.pointerId,
      dy: r.top + r.height / 2 - e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    G = drag;
    beginDragUI(drag);
  }
  const headBottom = () => {
    const hd = rootEl.querySelector(".rhead");
    return hd ? hd.getBoundingClientRect().bottom : 0;
  };
  function beginDragUI(g: Press | HandleDrag) {
    rootEl.classList.add("dragging");
    sheetEl.classList.add("lowered");
    const loop = () => {
      if (isDestroyed() || G !== g || !(g.sweeping || g.handle)) return;
      const top = headBottom() + 40,
        bottom = win.innerHeight - 110;
      let d = 0;
      if (g.lastY < top) d = -Math.min(18, (top - g.lastY) / 3);
      else if (g.lastY > bottom) d = Math.min(18, (g.lastY - bottom) / 3);
      if (d) {
        win.scrollBy(0, d);
        updateDrag();
      }
      g.raf = raf(loop);
    };
    g.raf = raf(loop);
  }
  let dragEndedAt = 0;
  function endDrag() {
    dragEndedAt = Date.now();
    rootEl.classList.remove("dragging");
    sheetEl.classList.remove("lowered");
    if (S.sel) {
      renderSel();
      openSheet("new");
    }
  }
  function tokenAt(x: number, y: number, mi: number) {
    const v = S.views[mi];
    if (!v) return null;
    const el = doc.elementFromPoint ? doc.elementFromPoint(x, y) : null;
    if (el) {
      const tk = el.closest<HTMLElement>(".tk");
      if (tk && Number(tk.dataset.m) === mi) return Number(tk.dataset.t);
      const g = el.closest<HTMLElement>(".gap");
      if (g && Number(g.dataset.m) === mi) {
        const k = Number(g.dataset.after);
        const fwd = S.sel && S.sel.focus >= S.sel.anchor;
        return clamp(fwd ? k : k + 1, 0, v.tokens.length - 1);
      }
    }
    let best: number | null = null,
      bd = Infinity;
    for (const tk of v.tokens) {
      const r = tk.el.getBoundingClientRect();
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = dy * 4 + dx;
      if (d < bd) {
        bd = d;
        best = Number(tk.el.dataset.t);
      }
    }
    return best;
  }
  function updateDrag() {
    if (!G || !S.sel) return;
    const t = tokenAt(G.lastX, G.lastY + (G.dy || 0), G.mi);
    if (t != null && t !== S.sel.focus) {
      S.sel.focus = t;
      renderSel();
    }
  }
  // With a selection open, the header, footer and mark-list buttons are held back too, so nothing else can drop it.
  on(
    doc,
    "click",
    (e) => {
      const target = targetEl(e);
      if (
        S.screen !== "review" ||
        !S.sel ||
        !target ||
        !rootEl.contains(target) ||
        !target.closest(".rhead button,.rfoot button,.anns button")
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      nudgeChoice();
    },
    true,
  );
  on(doc, "click", (e) => {
    const target = targetEl(e);
    if (
      S.screen !== "review" ||
      !(S.sel || S.editing) ||
      !target?.isConnected ||
      Date.now() - dragEndedAt < 400
    )
      return;
    if (!rootEl.contains(target)) return;
    if (
      target.closest(".tk,.handle,.kr-sheet,.kr-toasts,.anns,.rhead,.rfoot")
    )
      return;
    if (S.sel) {
      nudgeChoice();
      return;
    }
    clearSel();
  });

  return {
    clearSel,
    headBottom,
    newSelection,
    placeHandles,
    renderSel,
    selRange,
  };
}
