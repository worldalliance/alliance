/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

export function createAnnotations(ctx) {
  const {
    S,
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
    markBadge,
    markCls,
    newId,
    plural,
    recompute,
    renderScore,
    res,
    sheetEl,
    sideOf,
    spanText,
    toast,
    updateUndo,
    vcls,
  } = ctx;
  const closeSheet = (...args) => ctx.closeSheet(...args);
  const focusNote = (...args) => ctx.focusNote(...args);
  const openSheet = (...args) => ctx.openSheet(...args);
  const promptNote = (...args) => ctx.promptNote(...args);
  const renderSel = (...args) => ctx.renderSel(...args);
  const selRange = (...args) => ctx.selRange(...args);

  function renderAnns() {
    if (S.screen !== "review") return;
    const r = res(cur()),
      locked = r.status === "done";
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
            locked || a.orphaned
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
            locked
              ? null
              : h(
                  "span",
                  { class: "ann-act" },
                  a.value
                    ? h(
                        "button",
                        {
                          type: "button",
                          class: "mini",
                          onclick: () => flip(a.id),
                          "aria-label": `Flip “${clip(a.text, 30)}” to ${fmt(-a.value)}`,
                        },
                        "Flip",
                      )
                    : null,
                  h(
                    "button",
                    {
                      type: "button",
                      class: "mini",
                      onclick: () => removeAnn(a.id),
                      "aria-label": `Remove mark on “${clip(a.text, 30)}”`,
                    },
                    "Remove",
                  ),
                ),
            a.note
              ? h(
                  "span",
                  { class: "ann-n" },
                  a.note,
                  locked || a.orphaned
                    ? null
                    : h(
                        "button",
                        {
                          type: "button",
                          class: "mini",
                          onclick: () => editNote(a.id),
                          "aria-label": `Edit note on “${clip(a.text, 30)}”`,
                        },
                        icon("pencil"),
                        "Edit note",
                      ),
                )
              : null,
          ),
        ),
      );
      v.list.hidden = !all.length;
    }
  }
  /* ---------- Mutations + undo ---------- */
  function pushHist(tid, anns) {
    const st = (S.history[tid] ||= []);
    st.push(clone(anns));
    if (st.length > 200) st.shift();
  }
  function mutate(fn) {
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
    updateUndo();
  }
  function undo() {
    const t = cur(),
      r = res(t),
      st = S.history[t.id];
    if (r.status === "done" || !st || !st.length) return;
    r.annotations = st.pop();
    recompute(r);
    changed();
    S.sel = null;
    S.editing = null;
    closeSheet();
    renderAnns();
    renderSel();
    renderScore();
    updateUndo();
    toast("Undone");
  }
  function overlapping(mi, s, e) {
    return res(cur()).annotations.filter(
      (a) => a.messageIndex === mi && !a.orphaned && a.start < e && s < a.end,
    );
  }
  function applyNew(v) {
    if (!S.sel) return;
    const note = S.noteDraft.trim().slice(0, 140);
    if (!v && !note) {
      focusNote();
      return;
    }
    const view = S.views[S.sel.mi],
      [lo, hi] = selRange();
    const kb = S.sheet && S.sheet.kb;
    const ann = {
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
    if (v < 0 && !note && isFirstMinus(ann)) promptNote(ann.id);
  }
  // The first −1 per AI is the one that seeds the lock-in reason, so it's worth a nudge to say why.
  function isFirstMinus(ann) {
    const t = cur(),
      side = sideOf(t, ann.messageIndex);
    return !res(t).annotations.some(
      (a) =>
        a.id !== ann.id &&
        a.value < 0 &&
        !a.orphaned &&
        sideOf(t, a.messageIndex) === side,
    );
  }
  function editNote(id) {
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
  const findAnn = (id) => res(cur()).annotations.find((a) => a.id === id);
  function openEdit(id) {
    const a = findAnn(id);
    S.sel = null;
    S.editing = id;
    S.noteDraft = (a && a.note) || "";
    renderSel();
    renderAnns();
    openSheet("edit");
  }
  // Saves the edit sheet's note box if it changed. An emptied neutral note keeps its old text, since a note is all it is.
  function commitNote(id) {
    const a = findAnn(id);
    if (!a) return;
    const note = S.noteDraft.trim().slice(0, 140);
    if (note === (a.note || "") || (!note && !a.value)) return;
    mutate((r) => {
      const x = r.annotations.find((z) => z.id === id);
      if (note) x.note = note;
      else delete x.note;
    });
  }
  function flip(id) {
    const a = findAnn(id);
    if (!a) return;
    setValue(id, -a.value, `Flipped to ${fmt(-a.value)}`);
  }
  function setValue(id, to, msg) {
    if (S.sheet && S.sheet.mode === "edit") commitNote(id);
    mutate((r) => {
      const x = r.annotations.find((z) => z.id === id);
      x.value = to;
    });
    S.editing = null;
    S.noteDraft = "";
    renderAnns();
    closeSheet();
    toast(msg || `Changed to ${fmt(to)}`, undo);
  }
  // Tapping away doesn't drop an open selection (only ✕ or Escape does): it points at the choices instead.
  function nudgeChoice() {
    const acts = sheetEl.querySelector(".sh-acts");
    if (acts) {
      acts.classList.remove("nudge");
      void acts.offsetWidth;
      acts.classList.add("nudge");
    }
    toast("Pick +1, −1, a note, or ✕ to cancel");
  }
  function removeAnn(id) {
    const a = findAnn(id);
    if (!a) return;
    S.noteDraft = "";
    mutate((r) => {
      r.annotations = r.annotations.filter((z) => z.id !== id);
    });
    S.editing = null;
    renderAnns();
    closeSheet();
    toast(`Removed ${fmt(a.value)}`, undo);
  }
  function saveNote() {
    const { annId } = S.sheet;
    if (!findAnn(annId)) return;
    const note = S.noteDraft.trim().slice(0, 140);
    mutate((r) => {
      const x = r.annotations.find((z) => z.id === annId);
      if (note) x.note = note;
      else delete x.note;
    });
    S.editing = null;
    S.noteDraft = "";
    renderAnns();
    closeSheet();
    toast(note ? "Note saved" : "Note removed", undo);
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
