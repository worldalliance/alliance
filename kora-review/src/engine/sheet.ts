import type { SheetCtx } from "./context.js";
import type { SheetMode, SheetOpts } from "./types.js";

type SheetPart = HTMLElement | HTMLElement[] | null;

export function createSheet(ctx: SheetCtx) {
  const {
    $,
    S,
    applyNew,
    clearSel,
    clip,
    isDestroyed,
    doc,
    findAnn,
    flip,
    fmt,
    h,
    headBottom,
    icon,
    later,
    markBadge,
    on,
    openEdit,
    overlapping,
    plural,
    raf,
    removeAnn,
    rootEl,
    saveNote,
    selRange,
    setValue,
    setVar,
    sheetEl,
    sheetIn,
    spanText,
    win,
  } = ctx;

  /* ---------- Bottom sheet ---------- */
  let sheetReturn: HTMLElement | null = null;
  function openSheet(mode: SheetMode, opts: SheetOpts = {}) {
    const a = doc.activeElement;
    if (
      !S.sheet &&
      a instanceof HTMLElement &&
      rootEl.contains(a) &&
      !sheetEl.contains(a)
    )
      sheetReturn = a;
    S.sheet = { mode, ...opts };
    renderSheet();
    sheetEl.hidden = false;
    raf(() => {
      if (!isDestroyed()) {
        sheetEl.classList.add("open");
        syncSheetH();
        keepSelVisible();
      }
    });
  }
  function closeSheet() {
    const hadFocus = sheetEl.contains(doc.activeElement);
    S.sheet = null;
    sheetEl.classList.remove("open", "lowered");
    sheetEl.hidden = true;
    setVar("--sheet-h", "0px");
    if (hadFocus && sheetReturn && sheetReturn.isConnected)
      sheetReturn.focus({ preventScroll: true });
    sheetReturn = null;
  }
  function syncSheetH() {
    setVar("--sheet-h", S.sheet ? sheetEl.offsetHeight + "px" : "0px");
  }
  let ro: ResizeObserver | null = null;
  if (win.ResizeObserver) {
    ro = new win.ResizeObserver(syncSheetH);
    ro.observe(sheetEl);
  }
  function keepSelVisible() {
    if (!S.sel) return;
    const v = S.views[S.sel.mi];
    if (!v) return;
    const el = v.tokens[S.sel.focus].el,
      r = el.getBoundingClientRect();
    const limit = win.innerHeight - sheetEl.offsetHeight - 16;
    if (r.bottom > limit)
      win.scrollBy({ top: r.bottom - limit + 8, behavior: "smooth" });
    const top = headBottom() + 8;
    if (r.top < top) win.scrollBy({ top: r.top - top - 8, behavior: "smooth" });
  }
  function focusNote() {
    later(() => {
      const n = $("note");
      if (n instanceof HTMLTextAreaElement) {
        n.focus();
        n.setSelectionRange(n.value.length, n.value.length);
      }
    }, 60);
  }
  const NOTE_PLACEHOLDER =
    "Tell us why you feel positive or negative about this part of the chat.";
  function noteField(onEnter: (() => void) | null, onInput?: () => void) {
    const ta = h("textarea", {
      id: "note",
      maxlength: 140,
      rows: 2,
      placeholder: NOTE_PLACEHOLDER,
    });
    ta.value = S.noteDraft;
    const cnt = h(
      "span",
      { class: "cnt", "aria-hidden": "true" },
      `${S.noteDraft.length}/140`,
    );
    ta.addEventListener("input", () => {
      S.noteDraft = ta.value.slice(0, 140);
      cnt.textContent = `${S.noteDraft.length}/140`;
      if (onInput) onInput();
    });
    ta.addEventListener("keydown", (e) => {
      if (onEnter && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onEnter();
      }
    });
    return h(
      "div",
      { class: "sh-note" },
      h("label", { for: "note" }, "Note (optional)"),
      ta,
      cnt,
    );
  }
  function renderSheet() {
    if (!S.sheet) return;
    const sheet = SHEETS[S.sheet.mode];
    sheetIn.replaceChildren(
      h("div", { class: "grip", "aria-hidden": "true" }),
      ...sheet
        .parts()
        .flat()
        .filter((p) => p !== null),
    );
    sheetEl.setAttribute("aria-label", sheet.label);
  }
  const SHEETS: Record<SheetMode, { label: string; parts: () => SheetPart[] }> =
    {
      new: { label: "Mark selection", parts: sheetNew },
      edit: { label: "Edit mark", parts: sheetEdit },
      note: { label: "Note", parts: sheetNote },
    };
  function sheetNew(): SheetPart[] {
    if (!S.sel) return [];
    const v = S.views[S.sel.mi],
      [lo, hi] = selRange();
    const txt = spanText(v, lo, hi),
      words = hi - lo + 1;
    const over = overlapping(
      S.sel.mi,
      v.tokens[lo].start,
      v.tokens[hi].end,
    ).length;
    // The note button saves a neutral note, so it waits for some text.
    const pen = h(
      "button",
      {
        type: "button",
        class: "big note-btn",
        onclick: () => applyNew(0),
        disabled: !S.noteDraft.trim(),
        title: "Save as a neutral note",
      },
      icon("pencil"),
      "Note",
    );
    return [
      h(
        "div",
        { class: "sh-top" },
        h("p", { class: "sh-prev" }, `“${clip(txt, 160)}”`),
        h("span", { class: "sh-count" }, plural(words, "word")),
        h(
          "button",
          {
            type: "button",
            class: "iconbtn sh-x",
            onclick: clearSel,
            "aria-label": "Cancel (Esc)",
            title: "Cancel (Esc)",
          },
          icon("x"),
        ),
      ),
      over
        ? h(
            "p",
            { class: "sh-warn" },
            `This replaces ${plural(over, "existing mark")}.`,
          )
        : null,
      S.sheet?.kb
        ? h(
            "p",
            { class: "sh-warn" },
            "Arrow keys move the selection, Shift extends it. Press + or −, or Tab to the buttons.",
          )
        : null,
      noteField(null, () => {
        pen.disabled = !S.noteDraft.trim();
      }),
      h(
        "div",
        { class: "sh-acts" },
        h(
          "button",
          { type: "button", class: "big plus", onclick: () => applyNew(1) },
          icon("up"),
          "+1",
        ),
        h(
          "button",
          { type: "button", class: "big minus", onclick: () => applyNew(-1) },
          icon("down"),
          "−1",
        ),
        pen,
      ),
    ];
  }
  function sheetEdit(): SheetPart[] {
    const a = S.editing ? findAnn(S.editing) : undefined;
    if (!a) return [];
    return [
      h(
        "div",
        { class: "sh-top" },
        markBadge(a.value, "vbadge"),
        h("p", { class: "sh-prev" }, `“${clip(a.text, 160)}”`),
      ),
      noteField(null),
      h(
        "div",
        { class: "sh-acts" },
        a.value
          ? h(
              "button",
              {
                type: "button",
                class: "big " + (a.value > 0 ? "minus" : "plus"),
                onclick: () => flip(a.id),
              },
              icon("flip"),
              `Flip to ${fmt(-a.value)}`,
            )
          : [
              h(
                "button",
                {
                  type: "button",
                  class: "big plus",
                  onclick: () => setValue(a.id, 1),
                },
                icon("up"),
                "+1",
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "big minus",
                  onclick: () => setValue(a.id, -1),
                },
                icon("down"),
                "−1",
              ),
            ],
        h(
          "button",
          {
            type: "button",
            class: "big ghost",
            onclick: () => removeAnn(a.id),
          },
          icon("trash"),
          "Remove",
        ),
      ),
      h(
        "div",
        { class: "sh-sub" },
        h("span"),
        h(
          "button",
          { type: "button", class: "link quiet", onclick: clearSel },
          "Done",
        ),
      ),
    ];
  }
  function sheetNote(): SheetPart[] {
    const a = sheetAnn();
    if (!a) return [];
    return [
      h("p", { class: "sh-prev" }, `“${clip(a.text, 120)}”`),
      noteField(saveNote),
      h(
        "div",
        { class: "sh-acts" },
        h(
          "button",
          { type: "button", class: "big primary", onclick: saveNote },
          "Save note",
        ),
        h(
          "button",
          { type: "button", class: "big ghost", onclick: () => openEdit(a.id) },
          "Back",
        ),
      ),
    ];
  }
  function sheetAnn() {
    const id = S.sheet?.annId;
    return id ? findAnn(id) : undefined;
  }
  /* ---------- Keyboard-aware sheet position on phones ---------- */
  if (win.visualViewport) {
    const vv = win.visualViewport;
    const fit = () =>
      setVar(
        "--kb",
        Math.max(0, win.innerHeight - vv.height - vv.offsetTop) + "px",
      );
    on(vv, "resize", fit);
    on(vv, "scroll", fit);
  }

  const disconnectResize = () => {
    if (ro) ro.disconnect();
  };

  return {
    disconnectResize,
    closeSheet,
    focusNote,
    keepSelVisible,
    openSheet,
    renderSheet,
    syncSheetH,
  };
}
