import { REVIEW_RULES } from "../copy.js";
import type { GuideCtx } from "./context.js";

export function createGuide(ctx: GuideCtx) {
  const { S, h, icon, renderMarkdown } = ctx;

  /**
   * The one-page guide for this conversation's risk, folded by default and open the first time the
   * reviewer meets the risk (spec 6.0 sections 3.1 and 8). Its state is the reviewer's, not exported.
   */
  function guidePanel(params: { guide: string; riskName: string }) {
    const body = h("div", { class: "guide-body", id: "guide-body" });
    renderMarkdown(body, params.guide, -1, false);
    body.hidden = !S.guideOpen;
    const toggle = h(
      "button",
      {
        type: "button",
        class: "guide-toggle",
        "aria-expanded": String(S.guideOpen),
        "aria-controls": "guide-body",
        onclick: () => {
          S.guideOpen = !S.guideOpen;
          body.hidden = !S.guideOpen;
          toggle.setAttribute("aria-expanded", String(S.guideOpen));
        },
      },
      icon("note"),
      `Guide: ${params.riskName}`,
      h("span", { class: "guide-caret", "aria-hidden": "true" }, icon("right")),
    );
    return h("section", { class: "guide card" }, toggle, body);
  }

  /** On every screen: the two rules the whole review rests on (spec 6.0 section 3). */
  const rules = () => h("p", { class: "rules" }, REVIEW_RULES);

  return { guidePanel, rules };
}
