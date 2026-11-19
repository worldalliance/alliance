import type { PresentationCtx } from "./context.js";
import type { Valence } from "./types.js";

export function createPresentation(ctx: PresentationCtx) {
  const { budgetUnits, h, hueOf, icon, spentUnits } = ctx;

  function riskChip(riskId: string, riskName: string) {
    return h(
      "span",
      { class: "chip", style: `--h:${hueOf(riskId)}`, title: riskName },
      h("span", { class: "dot", "aria-hidden": "true" }),
      riskName,
    );
  }
  /** The session's load budget, not a count of conversations: a long one must not read as a fraction. */
  function progressBar() {
    const budget = budgetUnits();
    const done = Math.min(100, Math.round((spentUnits() / budget) * 100));
    return h(
      "div",
      {
        class: "sprog",
        style: `--sprog-done:${done}%`,
        role: "progressbar",
        "aria-valuemin": "0",
        "aria-valuemax": "100",
        "aria-valuenow": String(done),
        "aria-label": "Session progress",
      },
      h("span", { class: "sprog-text" }, `${done}% of this session`),
    );
  }
  function topBar(params: {
    chip?: Node;
    child?: string;
    stage?: Node;
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
          params.child ? h("span", { class: "cage" }, params.child) : null,
          h("span", { class: "grow" }),
          params.stage,
        ),
        params.below,
      ),
    );
  }
  function brandMark() {
    return h(
      "span",
      { class: "mark", "aria-hidden": "true" },
      h("b", { class: "p" }, "👍"),
      h("b", { class: "n" }, "👎"),
    );
  }

  /** Like and dislike reuse the positive and negative colours the stylesheet already carries. */
  const markCls = (valence: Valence) => (valence === "like" ? "pos" : "neg");
  const markBadge = (valence: Valence, cls: string) =>
    h(
      "span",
      { class: `${cls} v-${markCls(valence)}` },
      icon(valence === "like" ? "up" : "down"),
      h("span", { class: "sr" }, valence === "like" ? "Like:" : "Dislike:"),
    );

  return { brandMark, markBadge, markCls, progressBar, riskChip, topBar };
}
