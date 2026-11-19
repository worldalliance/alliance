import { DISLIKE_REASONS, LIKE_REASONS } from "../schemas.js";
import type { SheetCtx } from "./context.js";
import type { Reason, SheetMode, SheetOpts, Valence } from "./types.js";

type SheetPart = HTMLElement | HTMLElement[] | null;

const REASON_LABEL: Record<string, string> = {
  unsafe_advice: "Unsafe advice",
  not_for_this_age: "Not for this age",
  cold_or_preachy: "Cold or preachy",
  pretends_to_be_a_friend: "Pretends to be a friend",
  caring: "Caring",
  points_to_an_adult: "Points to an adult",
  other: "Other",
};
const reasonsFor = (valence: Valence): string[] =>
  valence === "like" ? LIKE_REASONS : DISLIKE_REASONS;

export function createSheet(ctx: SheetCtx) {
  const {
    S,
    applyNew,
    clearSel,
    clip,
    doc,
    drop,
    find,
    flip,
    h,
    headBottom,
    icon,
    isDestroyed,
    later,
    markBadge,
    on,
    overlapping,
    plural,
    raf,
    selRange,
    setReason,
    setVar,
    sheetEl,
    sheetIn,
    win,
  } = ctx;

  let sheetReturn: HTMLElement | null = null;
  function openSheet(mode: SheetMode, opts: SheetOpts = {}) {
    const active = doc.activeElement;
    if (
      !S.sheet &&
      active instanceof HTMLElement &&
      !sheetEl.contains(active) &&
      sheetEl.ownerDocument.contains(active)
    )
      sheetReturn = active;
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
    const view = S.views[S.sel.mi];
    if (!view) return;
    const el = view.tokens[S.sel.focus].el,
      box = el.getBoundingClientRect();
    const limit = win.innerHeight - sheetEl.offsetHeight - 16;
    if (box.bottom > limit)
      win.scrollBy({ top: box.bottom - limit + 8, behavior: "smooth" });
    const top = headBottom() + 8;
    if (box.top < top)
      win.scrollBy({ top: box.top - top - 8, behavior: "smooth" });
  }

  function renderSheet() {
    if (!S.sheet) return;
    const sheet = SHEETS[S.sheet.mode];
    sheetIn.replaceChildren(
      h("div", { class: "grip", "aria-hidden": "true" }),
      ...sheet
        .parts()
        .flat()
        .filter((part) => part !== null),
    );
    sheetEl.setAttribute("aria-label", sheet.label);
  }
  const SHEETS: Record<SheetMode, { label: string; parts: () => SheetPart[] }> =
    {
      new: { label: "Highlight this passage", parts: sheetNew },
      edit: { label: "Edit highlight", parts: sheetEdit },
    };

  function sheetNew(): SheetPart[] {
    if (!S.sel) return [];
    const view = S.views[S.sel.mi],
      [lo, hi] = selRange();
    const text = view.content.slice(view.tokens[lo].start, view.tokens[hi].end);
    const over = overlapping(
      S.sel.mi,
      view.tokens[lo].start,
      view.tokens[hi].end,
    ).length;
    return [
      h(
        "div",
        { class: "sh-top" },
        h("p", { class: "sh-prev" }, `“${clip(text, 160)}”`),
        h("span", { class: "sh-count" }, plural(hi - lo + 1, "word")),
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
            `This replaces ${plural(over, "highlight")}.`,
          )
        : null,
      S.sheet?.kb
        ? h(
            "p",
            { class: "sh-warn" },
            "Arrow keys move the selection, Shift extends it. Press + or −, or Tab to the buttons.",
          )
        : null,
      h(
        "div",
        { class: "sh-acts" },
        h(
          "button",
          {
            type: "button",
            class: "big plus",
            onclick: () => applyNew("like"),
          },
          icon("up"),
          "I like this",
        ),
        h(
          "button",
          {
            type: "button",
            class: "big minus",
            onclick: () => applyNew("dislike"),
          },
          icon("down"),
          "I don't like this",
        ),
      ),
    ];
  }

  function reasonChips(id: string, valence: Valence, chosen: Reason | null) {
    return h(
      "div",
      { class: "sh-reasons", role: "group", "aria-label": "Reason (optional)" },
      reasonsFor(valence).map((reason) =>
        h(
          "button",
          {
            type: "button",
            class: "chipbtn" + (chosen === reason ? " on" : ""),
            "aria-pressed": String(chosen === reason),
            onclick: () => setReason(id, reason as Reason),
          },
          REASON_LABEL[reason] ?? reason,
        ),
      ),
    );
  }

  function sheetEdit(): SheetPart[] {
    const highlight = S.editing ? find(S.editing) : undefined;
    if (!highlight) return [];
    return [
      h(
        "div",
        { class: "sh-top" },
        markBadge(highlight.valence, "vbadge"),
        h("p", { class: "sh-prev" }, `“${clip(highlight.text, 160)}”`),
        h(
          "button",
          {
            type: "button",
            class: "iconbtn sh-x",
            onclick: clearSel,
            "aria-label": "Done (Esc)",
            title: "Done (Esc)",
          },
          icon("x"),
        ),
      ),
      h("p", { class: "sh-label" }, "Why? (optional)"),
      reasonChips(highlight.id, highlight.valence, highlight.reason),
      h(
        "div",
        { class: "sh-sub" },
        h(
          "button",
          {
            type: "button",
            class: "link",
            onclick: () => flip(highlight.id),
          },
          icon("flip"),
          highlight.valence === "like"
            ? "Change to don't like"
            : "Change to like",
        ),
        h(
          "button",
          {
            type: "button",
            class: "link quiet",
            onclick: () => drop(highlight.id),
          },
          icon("trash"),
          "Remove",
        ),
      ),
    ];
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
  const focusSheet = () =>
    later(() => {
      sheetEl.querySelector("button")?.focus();
    }, 60);

  return {
    closeSheet,
    disconnectResize,
    focusSheet,
    keepSelVisible,
    openSheet,
    renderSheet,
    syncSheetH,
  };
}
