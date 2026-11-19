import type { HighlightsCtx, Late } from "./context.js";
import type { Highlight, Rating, Reason, Valence } from "./types.js";

export function createHighlights(ctx: HighlightsCtx) {
  const {
    $$,
    S,
    announce,
    changed,
    clip,
    clone,
    cur,
    ensure,
    floatMark,
    iso,
    markCls,
    newId,
    plural,
    res,
    toast,
  } = ctx;
  const closeSheet: Late["closeSheet"] = (...a) => ctx.late().closeSheet(...a);
  const openSheet: Late["openSheet"] = (...a) => ctx.late().openSheet(...a);
  const renderSel: Late["renderSel"] = (...a) => ctx.late().renderSel(...a);
  const selRange: Late["selRange"] = (...a) => ctx.late().selRange(...a);

  function renderHighlights() {
    if (S.screen !== "read" && S.screen !== "judge") return;
    const r = res(cur());
    for (const view of Object.values(S.views)) {
      for (const token of view.tokens) {
        token.el.classList.remove("pos", "neg", "focus");
        token.hl = null;
      }
      for (const gaps of Object.values(view.gaps))
        for (const gap of gaps) gap.classList.remove("pos", "neg", "focus");
      for (const h of r.highlights) {
        if (h.orphaned || h.turnIndex !== view.mi) continue;
        for (const token of view.tokens)
          if (token.start >= h.start && token.end <= h.end) {
            token.hl = h;
            token.el.classList.add(markCls(h.valence));
            if (h.id === S.editing) token.el.classList.add("focus");
          }
      }
      for (let k = 0; k < view.tokens.length - 1; k++) {
        const h = view.tokens[k].hl;
        if (h && view.tokens[k + 1].hl === h)
          for (const gap of view.gaps[k] || []) {
            gap.classList.add(markCls(h.valence));
            if (h.id === S.editing) gap.classList.add("focus");
          }
      }
    }
  }

  function pushHistory(conversationId: string, highlights: Highlight[]) {
    const stack = (S.history[conversationId] ||= []);
    stack.push(clone(highlights));
    if (stack.length > 200) stack.shift();
  }
  function mutate(fn: (r: Rating) => void) {
    const item = cur(),
      r = ensure(item);
    if (r.status !== "reading") return;
    pushHistory(item.conversationId, r.highlights);
    fn(r);
    changed();
    renderHighlights();
    renderSel();
  }
  function undo() {
    const item = cur(),
      r = res(item);
    if (r.status !== "reading") return;
    const previous = S.history[item.conversationId]?.pop();
    if (!previous) return;
    r.highlights = previous;
    changed();
    S.sel = null;
    S.editing = null;
    closeSheet();
    renderHighlights();
    renderSel();
    toast("Undone");
  }

  const find = (id: string) => res(cur()).highlights.find((h) => h.id === id);
  function overlapping(mi: number, start: number, end: number) {
    return res(cur()).highlights.filter(
      (h) =>
        h.turnIndex === mi && !h.orphaned && h.start < end && start < h.end,
    );
  }

  /** The sheet's first tap: the span becomes a highlight, and the sheet stays open for its reason. */
  function applyNew(valence: Valence) {
    if (!S.sel) return;
    const view = S.views[S.sel.mi],
      [lo, hi] = selRange();
    const highlight: Highlight = {
      id: newId(),
      turnIndex: S.sel.mi,
      start: view.tokens[lo].start,
      end: view.tokens[hi].end,
      text: view.content.slice(view.tokens[lo].start, view.tokens[hi].end),
      valence,
      reason: null,
      createdAt: iso(),
    };
    let replaced = 0;
    mutate((r) => {
      const keep = r.highlights.filter(
        (h) =>
          !(
            h.turnIndex === highlight.turnIndex &&
            !h.orphaned &&
            h.start < highlight.end &&
            highlight.start < h.end
          ),
      );
      replaced = r.highlights.length - keep.length;
      keep.push(highlight);
      keep.sort((a, b) => a.turnIndex - b.turnIndex || a.start - b.start);
      r.highlights = keep;
    });
    S.sel = null;
    S.editing = highlight.id;
    renderSel();
    renderHighlights();
    openSheet("edit");
    floatMark(valence, view.tokens[lo].el, view.tokens[hi].el);
    announce(
      `${valence === "like" ? "Liked" : "Disliked"} “${clip(highlight.text, 60)}”.${
        replaced ? ` Replaced ${plural(replaced, "highlight")}.` : ""
      }`,
    );
  }

  function openEdit(id: string) {
    S.sel = null;
    S.editing = id;
    renderSel();
    renderHighlights();
    openSheet("edit");
  }
  function setReason(id: string, reason: Reason) {
    mutate((r) => {
      const h = r.highlights.find((x) => x.id === id);
      if (h) h.reason = h.reason === reason ? null : reason;
    });
    openSheet("edit");
  }
  function flip(id: string) {
    mutate((r) => {
      const h = r.highlights.find((x) => x.id === id);
      // The reasons on offer differ by valence, so a flipped highlight keeps none.
      if (h) {
        h.valence = h.valence === "like" ? "dislike" : "like";
        h.reason = null;
      }
    });
    openSheet("edit");
    toast("Flipped");
  }
  function drop(id: string) {
    if (!find(id)) return;
    mutate((r) => {
      r.highlights = r.highlights.filter((x) => x.id !== id);
    });
    S.editing = null;
    closeSheet();
    renderHighlights();
    toast("Highlight removed");
  }
  /** Tapping away doesn't drop an open selection: only ✕ or Escape does. */
  function nudgeChoice() {
    const acts = $$(".sh-acts")[0];
    if (acts) {
      acts.classList.remove("nudge");
      void acts.offsetWidth;
      acts.classList.add("nudge");
    }
    toast("Pick 👍 or 👎, or ✕ to cancel");
  }

  return {
    applyNew,
    drop,
    find,
    flip,
    mutate,
    nudgeChoice,
    openEdit,
    overlapping,
    renderHighlights,
    setReason,
    undo,
  };
}
