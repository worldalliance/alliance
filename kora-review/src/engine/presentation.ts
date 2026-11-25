import type { PresentationCtx } from "./context.js";

export function createPresentation(ctx: PresentationCtx) {
  const { catLabel, h, hueOf } = ctx;

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
    age?: Node;
    pairId?: string;
    stage: string;
    below?: Node;
  }) {
    return h(
      "header",
      { class: "rhead" },
      h(
        "div",
        { class: "wrap" },
        h(
          "div",
          { class: "rrow" },
          params.chip,
          params.age,
          params.pairId ? pairIdToggle(params.pairId) : null,
          h("span", { class: "grow" }),
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
        "aria-label": "Conversation ID",
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

  return { brandMark, catChip, topBar };
}
