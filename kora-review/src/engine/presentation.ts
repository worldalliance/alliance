import type { PresentationCtx } from "./context.js";

export function createPresentation(ctx: PresentationCtx) {
  const { catLabel, fmt, h, hueOf, icon, vcls } = ctx;

  function catChip(c: string) {
    return h(
      "span",
      { class: "chip", style: `--h:${hueOf(c)}`, title: catLabel(c) },
      h("span", { class: "dot", "aria-hidden": "true" }),
      catLabel(c),
    );
  }
  function topBar(params: {
    chip?: Node;
    age?: string;
    pairId?: string;
    stage: string;
    below?: Node;
  }) {
    return h(
      "header",
      { class: "rhead" },
      h(
        "div",
        { class: "wrap wide" },
        h(
          "div",
          { class: "rrow" },
          params.chip,
          params.age ? h("span", { class: "cage" }, params.age) : null,
          h("span", { class: "grow" }),
          params.pairId ? pairIdToggle(params.pairId) : null,
          h("span", { class: "prog" }, params.stage),
        ),
        params.below,
      ),
    );
  }
  function pairIdToggle(pairId: string) {
    const id = h("span", { class: "pair-id-text", hidden: true }, pairId);
    const toggle = h(
      "button",
      {
        type: "button",
        class: "pair-id-hash",
        "aria-label": "Pair ID",
        "aria-expanded": "false",
        onclick: () => {
          id.hidden = !id.hidden;
          toggle.setAttribute("aria-expanded", String(!id.hidden));
        },
      },
      "#",
    );
    return h("span", { class: "pair-id" }, toggle, id);
  }
  function brandMark() {
    return h(
      "span",
      { class: "mark", "aria-hidden": "true" },
      h("b", { class: "p" }, "+1"),
      h("b", { class: "n" }, "−1"),
    );
  }

  // A mark is +1, −1, or 0: a neutral note, shown with a pencil and counted towards neither side.
  const markCls = (v: number) => (v > 0 ? "pos" : v < 0 ? "neg" : "note");
  const markBadge = (v: number, cls: string) =>
    v
      ? h(
          "span",
          { class: cls + " " + vcls(v) },
          h("span", { "aria-hidden": "true" }, fmt(v)),
          h("span", { class: "sr" }, v > 0 ? "Plus one:" : "Minus one:"),
        )
      : h(
          "span",
          { class: cls + " v-note" },
          icon("note"),
          h("span", { class: "sr" }, "Note:"),
        );

  return { brandMark, catChip, markBadge, markCls, topBar };
}
