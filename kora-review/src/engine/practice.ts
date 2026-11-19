import type { PracticeCtx } from "./context.js";

export function createPractice(ctx: PracticeCtx) {
  const { app, brandMark, cur, h, icon, nextConversation, res } = ctx;

  const said = (verdict: string | null) =>
    verdict === "ok" ? "OK" : verdict === "not_ok" ? "Not OK" : "nothing";

  /** After each practice conversation, the reference answer and the one line that goes with it (Annex A9). */
  function renderPractice() {
    const item = cur();
    const reference = item.reference;
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "PRACTICE"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          `You said ${said(res(item).q1)}. Our reviewers said ${said(
            reference ? reference.verdict : null,
          )}.`,
        ),
        reference ? h("p", { class: "lede" }, reference.reason) : null,
        h(
          "p",
          { class: "fine" },
          "There is no score here and this one does not count. The point is to show you the kind of judgement we are asking for.",
        ),
        h(
          "div",
          { class: "oo-acts" },
          h(
            "button",
            { class: "big primary", type: "button", onclick: nextConversation },
            "Next",
            icon("right"),
          ),
        ),
      ),
    );
  }

  return { renderPractice };
}
