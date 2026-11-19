import type { KoraItem } from "../types.gen.js";
import type { ScreensCtx } from "./context.js";

export function createScreens(ctx: ScreensCtx) {
  const {
    o,
    S,
    announce,
    app,
    brandMark,
    endSession,
    fetchNext,
    h,
    icon,
    leave,
    openItem,
    optOutOfRisk,
    ratedDone,
    res,
    skip,
    plural,
  } = ctx;

  /* ---------- The content warning on a hard risk (spec 6.0 sections 3.4 and 6) ---------- */
  function needsWarning(item: KoraItem) {
    return (
      item.hard &&
      res(item).status === "reading" &&
      res(item).highlights.length === 0 &&
      S.warned !== item.conversationId
    );
  }
  function renderWarning({ then }: { then: string }) {
    const item = S.items.find((i) => i.conversationId === then);
    if (!item) return;
    app.replaceChildren(
      h(
        "main",
        { class: "optout wrap" },
        h("div", { class: "brand" }, brandMark(), "CONVERSATION REVIEW"),
        h(
          "h1",
          { class: "qtitle", tabindex: "-1", "data-focus": "" },
          `The next conversation is about ${item.riskName.toLowerCase()}.`,
        ),
        h(
          "p",
          { class: "lede" },
          "The child is simulated, but the content is realistic.",
        ),
        h(
          "p",
          { class: "lede" },
          "You can skip this one, or stop being shown this kind of situation altogether.",
        ),
        h(
          "div",
          { class: "oo-acts" },
          h(
            "button",
            {
              class: "big primary",
              type: "button",
              onclick: () => {
                S.warned = item.conversationId;
                openItem(S.items.indexOf(item));
              },
            },
            "Continue",
            icon("right"),
          ),
          h(
            "button",
            {
              class: "big ghost",
              type: "button",
              onclick: () => skip(item.conversationId),
            },
            "Skip this one",
          ),
          h(
            "button",
            {
              class: "big ghost",
              type: "button",
              onclick: () => {
                optOutOfRisk(item.riskId);
                skip(item.conversationId);
              },
            },
            `Skip this one and stop showing me ${item.riskName.toLowerCase()}`,
          ),
        ),
      ),
    );
  }

  function renderLoading({ failed }: { failed: boolean }) {
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap", "aria-busy": failed ? "false" : "true" },
        h("div", { class: "brand" }, brandMark(), "CONVERSATION REVIEW"),
        h(
          "h1",
          { class: "qtitle", tabindex: "-1", "data-focus": "" },
          failed
            ? "Couldn't load the next conversation"
            : "Loading the next conversation…",
        ),
        failed
          ? h(
              "p",
              { class: "lede" },
              "Your answers so far are saved. Check your connection, then try again.",
            )
          : null,
        failed
          ? h(
              "div",
              { class: "oo-acts" },
              h(
                "button",
                {
                  class: "big primary",
                  type: "button",
                  onclick: () => void fetchNext(),
                },
                "Try again",
              ),
            )
          : null,
      ),
    );
    if (failed) announce("Couldn't load the next conversation.");
  }

  /* ---------- Nothing left to serve (Annex A11) ---------- */
  function renderEmpty() {
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "CONVERSATION REVIEW"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          "That's everything available to you",
        ),
        h(
          "p",
          { class: "lede" },
          "You have reviewed everything available in the situations you chose. You can add situations back on your account page, turn on longer conversations, or finish here.",
        ),
        h(
          "div",
          { class: "oo-acts" },
          h(
            "button",
            { class: "big primary", type: "button", onclick: o.onOpenAccount },
            "Account page",
          ),
          h(
            "button",
            { class: "big ghost", type: "button", onclick: endSession },
            "I am done",
          ),
        ),
      ),
    );
  }

  /* ---------- The session is over (Annex A8) ---------- */
  function renderComplete() {
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "CONVERSATION REVIEW"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          "Thank you — that is a full session",
        ),
        h(
          "p",
          { class: "lede" },
          `You judged ${plural(ratedDone(), "conversation")}. Your answers are on their way to the researchers.`,
        ),
        h(
          "p",
          { class: "lede" },
          "You can start another session if you like: new conversations, same length. Or you can stop here, and we will send you a summary of what we found in the new year.",
        ),
        h(
          "div",
          { class: "oo-acts" },
          h(
            "button",
            {
              class: "big primary",
              type: "button",
              onclick: () => leave(true),
            },
            "Another session",
            icon("right"),
          ),
          h(
            "button",
            {
              class: "big ghost",
              type: "button",
              onclick: () => leave(false),
            },
            "I am done for now",
          ),
        ),
      ),
    );
  }

  return {
    needsWarning,
    renderComplete,
    renderEmpty,
    renderLoading,
    renderWarning,
  };
}
