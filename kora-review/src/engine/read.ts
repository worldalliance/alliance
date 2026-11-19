import type { KoraItem } from "../types.gen.js";
import type { Late, ReadCtx } from "./context.js";

export function createRead(ctx: ReadCtx) {
  const {
    S,
    app,
    blockHint,
    blockMsLeft,
    changed,
    cur,
    ensure,
    guidePanel,
    h,
    icon,
    optionOrder,
    P,
    plural,
    progressBar,
    renderMarkdown,
    res,
    riskChip,
    rules,
    submitRead,
    topBar,
    watchBlock,
  } = ctx;
  const renderHighlights: Late["renderHighlights"] = (...a) =>
    ctx.late().renderHighlights(...a);

  /** The child line above the conversation: age and, where KORA gives one, gender. */
  function childLine(item: KoraItem): string {
    const age = item.childAge === null ? null : `${item.childAge} years old`;
    return [item.childGender, age].filter(Boolean).join(", ") || "Child";
  }

  function renderConversation(item: KoraItem) {
    S.views = {};
    const thread = h("div", { class: "thread" });
    item.conversation.forEach((turn, i) => {
      const ai = turn.role === "ai";
      const bubble = h("div", { class: "bubble" + (ai ? " layer" : "") });
      // Both screens show the highlights; only the Read screen lets the reviewer make them.
      const marked = ai && turn.text.trim().length > 0;
      const view = renderMarkdown(bubble, turn.text, i, marked);
      if (!turn.text.trim())
        bubble.append(h("em", { class: "empty" }, "Empty answer."));
      if (marked && view.tokens.length) {
        S.views[i] = { ...view, bubble };
        if (S.screen === "read") {
          bubble.setAttribute("tabindex", "0");
          bubble.setAttribute("role", "group");
          bubble.setAttribute(
            "aria-label",
            "The AI's answer. Use the left and right arrow keys to select words to highlight, Shift with an arrow to extend.",
          );
          bubble.addEventListener("contextmenu", (e) => e.preventDefault());
        }
      }
      thread.append(
        h(
          "div",
          { class: "msg " + (ai ? "ai" : "user") },
          h("div", { class: "who" }, ai ? "AI" : "Child"),
          bubble,
        ),
      );
    });
    return thread;
  }

  function comprehension(item: KoraItem) {
    if (!item.comprehension) return null;
    const r = ensure(item);
    const options = item.comprehension.options;
    return h(
      "fieldset",
      { class: "field svq card", id: "comp" },
      h("legend", {}, "What did the child talk to the AI about?"),
      h(
        "div",
        { class: "opts" },
        optionOrder(item).map((index) =>
          h(
            "label",
            { class: "opt" },
            h("input", {
              type: "radio",
              name: P + "comp",
              value: String(index),
              checked: r.comprehensionAnswer === index,
              onchange: () => {
                r.comprehensionAnswer = index;
                changed();
                paintNext();
              },
            }),
            h("span", {}, options[index]),
          ),
        ),
      ),
    );
  }

  let next: HTMLButtonElement | null = null;
  let hint: HTMLElement | null = null;
  function paintNext() {
    if (!next || !hint) return;
    const item = cur(),
      r = res(item);
    const answered = !item.comprehension || r.comprehensionAnswer !== null;
    next.disabled = !answered || blockMsLeft() > 0;
    hint.textContent = blockHint();
  }

  function renderRead() {
    const item = cur();
    next = h(
      "button",
      { class: "big primary", type: "button", onclick: submitRead },
      "Next",
      icon("right"),
    );
    hint = h("p", { class: "fine block-hint", role: "status" });
    app.replaceChildren(
      topBar({
        chip: riskChip(item.riskId, item.riskName),
        child: childLine(item),
        stage: progressBar(),
        below: rules(),
      }),
      h(
        "main",
        { class: "wrap read" },
        h(
          "h1",
          { class: "sr", tabindex: "-1", "data-focus": "" },
          item.scenarioTitle || "A conversation to read",
        ),
        h(
          "section",
          { class: "situation card" },
          h("h2", { class: "q-l" }, "The child"),
          h("p", {}, item.childBackground),
          h("h2", { class: "q-l" }, "The situation"),
          h("p", {}, item.scenario),
        ),
        guidePanel({ guide: item.guide, riskName: item.riskName }),
        h(
          "p",
          { class: "fine" },
          `Highlight anything in the AI's answers you like or dislike as you read. It is optional. ${plural(
            item.conversation.filter((t) => t.role === "ai").length,
            "AI answer",
          )} here.`,
        ),
        renderConversation(item),
        comprehension(item),
        h("div", { class: "acts" }, next, hint),
      ),
    );
    renderHighlights();
    paintNext();
    watchBlock(paintNext);
  }

  return { paintNext, renderConversation, renderRead };
}
