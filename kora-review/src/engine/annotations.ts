import type { AnnotationsCtx, Late } from "./context.js";
import type { Annotation, Result } from "./types.js";

export function createAnnotations(ctx: AnnotationsCtx) {
  const {
    $,
    S,
    aiTurn,
    announce,
    changed,
    clip,
    clone,
    cur,
    dismissCoach,
    ensure,
    floatValue,
    fmt,
    h,
    icon,
    iso,
    letter,
    markBadge,
    markCls,
    newId,
    plural,
    recompute,
    renderScore,
    res,
    sheetEl,
    shownSides,
    sideOf,
    spanText,
    toast,
    vcls,
  } = ctx;
  const closeSheet: Late["closeSheet"] = (...args) =>
    ctx.late().closeSheet(...args);
  const focusNote: Late["focusNote"] = (...args) =>
    ctx.late().focusNote(...args);
  const openSheet: Late["openSheet"] = (...args) =>
    ctx.late().openSheet(...args);
  const renderRank: Late["renderRank"] = (...args) =>
    ctx.late().renderRank(...args);
  const renderSel: Late["renderSel"] = (...args) =>
    ctx.late().renderSel(...args);
  const selRange: Late["selRange"] = (...args) => ctx.late().selRange(...args);

  function renderAnns() {
    if (S.screen !== "review") return;
    const r = res(cur());
    for (const v of Object.values(S.views)) {
      for (const tk of v.tokens) {
        tk.el.classList.remove("pos", "neg", "note", "focus");
        tk.ann = null;
      }
      for (const els of Object.values(v.gaps))
        for (const g of els) g.classList.remove("pos", "neg", "note", "focus");
      const all = r.annotations.filter((a) => a.messageIndex === v.mi);
      for (const a of all) {
        if (a.orphaned) continue;
        for (const tk of v.tokens)
          if (tk.start >= a.start && tk.end <= a.end) {
            tk.ann = a;
            tk.el.classList.add(markCls(a.value));
            if (a.id === S.editing) tk.el.classList.add("focus");
          }
      }
      for (let k = 0; k < v.tokens.length - 1; k++) {
        const a = v.tokens[k].ann;
        if (a && v.tokens[k + 1].ann === a)
          for (const g of v.gaps[k] || []) {
            g.classList.add(markCls(a.value));
            if (a.id === S.editing) g.classList.add("focus");
          }
      }
      v.list.replaceChildren(
        ...all.map((a) =>
          h(
            "li",
            { class: "ann " + vcls(a.value) },
            markBadge(a.value, "ann-v"),
            a.orphaned
              ? h(
                  "span",
                  { class: "ann-q", style: "cursor:default" },
                  `“${a.text}”`,
                )
              : h(
                  "button",
                  {
                    type: "button",
                    class: "ann-q",
                    onclick: () => openEdit(a.id),
                  },
                  `“${a.text}”`,
                ),
            a.orphaned ? h("span", { class: "tag" }, "Not found") : null,
            h(
              "span",
              { class: "ann-act" },
              h(
                "button",
                {
                  type: "button",
                  class: "ann-ic",
                  onclick: () => removeAnn(a.id),
                  "aria-label": `Remove mark on “${clip(a.text, 30)}”`,
                  title: "Remove mark",
                },
                icon("trash"),
              ),
            ),
            a.note
              ? h(
                  "span",
                  { class: "ann-n" },
                  a.note,
                  a.orphaned
                    ? null
                    : h(
                        "button",
                        {
                          type: "button",
                          class: "ann-ic",
                          onclick: () => editNote(a.id),
                          "aria-label": `Edit note on “${clip(a.text, 30)}”`,
                          title: "Edit note",
                        },
                        icon("pencil"),
                      ),
                )
              : null,
          ),
        ),
      );
      v.list.hidden = !all.length;
    }
    renderMarks();
  }
  function renderMarks() {
    const box = $("marks");
    if (!box) return;
    const t = cur(),
      anns = [...res(t).annotations].sort(
        (x, y) => x.messageIndex - y.messageIndex || x.start - y.start,
      );
    box.replaceChildren(
      h("h2", { class: "rank-h", id: "marks-h" }, "Your marks"),
      h(
        "div",
        { class: "two-col" },
        shownSides(t).map((side) => {
          const name = "Chatbot " + letter(t, side),
            mine = anns.filter((a) => sideOf(t, a.messageIndex) === side);
          return h(
            "div",
            {},
            h("h3", { class: "q-l" }, name),
            mine.length
              ? h(
                  "ul",
                  { class: "anns", "aria-label": `Marks on ${name}` },
                  mine.map((a) => {
                    const words = `“${a.text}”`;
                    return h(
                      "li",
                      { class: "ann " + vcls(a.value) },
                      markBadge(a.value, "ann-v"),
                      h(
                        "span",
                        { class: "dim" },
                        `Turn ${aiTurn(t, a.messageIndex)}`,
                      ),
                      a.orphaned
                        ? h("span", { class: "ann-q" }, words)
                        : h(
                            "button",
                            {
                              type: "button",
                              class: "ann-q",
                              onclick: () => jumpTo(a.id),
                            },
                            words,
                          ),
                      a.orphaned
                        ? h("span", { class: "tag" }, "Not found")
                        : null,
                      a.note ? h("span", { class: "ann-n" }, a.note) : null,
                    );
                  }),
                )
              : h("p", { class: "dim" }, `No marks on ${name}.`),
          );
        }),
      ),
    );
  }
  function jumpTo(id: string) {
    for (const v of Object.values(S.views)) {
      const tk = v.tokens.find((x) => x.ann?.id === id);
      if (tk) {
        tk.el.scrollIntoView({ block: "center" });
        break;
      }
    }
    openEdit(id);
  }
  /* ---------- Mutations + undo ---------- */
  function pushHist(tid: string, anns: Annotation[]) {
    const st = (S.history[tid] ||= []);
    st.push(clone(anns));
    if (st.length > 200) st.shift();
  }
  function mutate(fn: (r: Result) => void) {
    const t = cur(),
      r = ensure(t);
    if (r.status === "done") return;
    pushHist(t.id, r.annotations);
    fn(r);
    recompute(r);
    changed();
    renderAnns();
    renderSel();
    renderScore();
    renderRank();
  }
  function undo() {
    const t = cur(),
      r = res(t);
    if (r.status === "done") return;
    const previous = S.history[t.id]?.pop();
    if (!previous) return;
    r.annotations = previous;
    recompute(r);
    changed();
    S.sel = null;
    S.editing = null;
    closeSheet();
    renderAnns();
    renderSel();
    renderScore();
    renderRank();
    toast("Undone");
  }
  function overlapping(mi: number, s: number, e: number) {
    return res(cur()).annotations.filter(
      (a) => a.messageIndex === mi && !a.orphaned && a.start < e && s < a.end,
    );
  }
  function applyNew(v: Annotation["value"]) {
    if (!S.sel) return;
    const note = S.noteDraft.trim().slice(0, 140);
    if (!v && !note) {
      focusNote();
      return;
    }
    const view = S.views[S.sel.mi],
      [lo, hi] = selRange();
    const kb = S.sheet && S.sheet.kb;
    const ann: Annotation = {
      id: newId(),
      messageIndex: S.sel.mi,
      start: view.tokens[lo].start,
      end: view.tokens[hi].end,
      text: spanText(view, lo, hi),
      value: v,
      createdAt: iso(),
    };
    if (note) ann.note = note;
    let replaced = 0;
    mutate((r) => {
      const keep = r.annotations.filter(
        (a) =>
          !(
            a.messageIndex === ann.messageIndex &&
            !a.orphaned &&
            a.start < ann.end &&
            ann.start < a.end
          ),
      );
      replaced = r.annotations.length - keep.length;
      keep.push(ann);
      keep.sort((x, y) => x.messageIndex - y.messageIndex || x.start - y.start);
      r.annotations = keep;
    });
    S.sel = null;
    S.noteDraft = "";
    renderSel();
    closeSheet();
    if (!S.coachDone) dismissCoach();
    if (v) floatValue(v, view.tokens[lo].el, view.tokens[hi].el);
    else toast("Note added");
    announce(
      `Marked ${fmt(v) === "0" ? "a note on" : fmt(v)} “${clip(ann.text, 60)}”.${replaced ? ` Replaced ${plural(replaced, "mark")}.` : ""}`,
    );
    if (kb) view.bubble.focus({ preventScroll: true });
  }
  function editNote(id: string) {
    const a = findAnn(id);
    if (!a) return;
    S.sel = null;
    S.editing = id;
    S.noteDraft = a.note || "";
    renderSel();
    renderAnns();
    openSheet("note", { annId: id });
    focusNote();
  }
  function annIn(r: Result, id: string) {
    const a = r.annotations.find((z) => z.id === id);
    if (!a) throw new Error(`no annotation ${id}`);
    return a;
  }
  const findAnn = (id: string) =>
    res(cur()).annotations.find((a) => a.id === id);
  function openEdit(id: string) {
    const a = findAnn(id);
    S.sel = null;
    S.editing = id;
    S.noteDraft = (a && a.note) || "";
    renderSel();
    renderAnns();
    openSheet("edit");
  }
  // Saves the edit sheet's note box if it changed. An emptied neutral note keeps its old text, since a note is all it is.
  function commitNote(id: string) {
    const a = findAnn(id);
    if (!a) return;
    const note = S.noteDraft.trim().slice(0, 140);
    if (note === (a.note || "") || (!note && !a.value)) return;
    mutate((r) => {
      const x = annIn(r, id);
      if (note) x.note = note;
      else delete x.note;
    });
  }
  function flip(id: string) {
    const a = findAnn(id);
    if (!a) return;
    const to = a.value === 1 ? -1 : a.value === -1 ? 1 : 0;
    setValue(id, to, `Flipped to ${fmt(to)}`);
  }
  function setValue(id: string, to: Annotation["value"], msg?: string) {
    if (S.sheet && S.sheet.mode === "edit") commitNote(id);
    mutate((r) => {
      annIn(r, id).value = to;
    });
    S.editing = null;
    S.noteDraft = "";
    renderAnns();
    closeSheet();
    toast(msg || `Changed to ${fmt(to)}`);
  }
  // Tapping away doesn't drop an open selection (only ✕ or Escape does): it points at the choices instead.
  function nudgeChoice() {
    const acts = sheetEl.querySelector<HTMLElement>(".sh-acts");
    if (acts) {
      acts.classList.remove("nudge");
      void acts.offsetWidth;
      acts.classList.add("nudge");
    }
    toast("Pick +1, −1, a note, or ✕ to cancel");
  }
  function removeAnn(id: string) {
    const a = findAnn(id);
    if (!a) return;
    S.noteDraft = "";
    mutate((r) => {
      r.annotations = r.annotations.filter((z) => z.id !== id);
    });
    S.editing = null;
    renderAnns();
    closeSheet();
    toast(`Removed ${fmt(a.value)}`);
  }
  function saveNote() {
    const annId = S.sheet?.annId;
    if (!annId || !findAnn(annId)) return;
    const note = S.noteDraft.trim().slice(0, 140);
    mutate((r) => {
      const x = annIn(r, annId);
      if (note) x.note = note;
      else delete x.note;
    });
    S.editing = null;
    S.noteDraft = "";
    renderAnns();
    closeSheet();
    toast(note ? "Note saved" : "Note removed");
  }

  return {
    applyNew,
    commitNote,
    editNote,
    findAnn,
    flip,
    mutate,
    nudgeChoice,
    openEdit,
    overlapping,
    removeAnn,
    renderAnns,
    saveNote,
    setValue,
    undo,
  };
}
