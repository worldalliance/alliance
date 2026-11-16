import { CONTENT_WARNING } from "../categories.js";
import type { KoraCategory } from "../types.gen.js";
import type { ScreensCtx } from "./context.js";
import type { Transcript } from "./types.js";

export function createScreens(ctx: ScreensCtx) {
  const {
    CAT,
    S,
    announce,
    app,
    brandMark,
    callOf,
    catChip,
    catLabel,
    category,
    changed,
    ensure,
    finishFlow,
    firstPendingIndex,
    h,
    icon,
    openTranscript,
    plural,
    progressText,
    refreshList,
    res,
    reviewed,
    transcript,
  } = ctx;

  /* ---------- Content warning before sensitive pairs ---------- */
  // Shown before each pending pair in a sensitive category the reviewer hasn't opened yet and hasn't skipped.
  function needsWarning(t: Transcript) {
    const c = CAT.get(t.category),
      r = res(t);
    return !!(
      c &&
      c.sensitive &&
      r.status !== "done" &&
      !r.optedOut &&
      !r.startedAt &&
      S.warned !== t.id
    );
  }
  const pendingIn = (id: string) =>
    S.list.filter((t) => t.category === id && !reviewed(res(t))).length;
  function renderWarning({ then }: { then: string }) {
    const w = CONTENT_WARNING,
      t = transcript(then),
      c = category(t.category);
    const label = c.label,
      n = pendingIn(c.id);
    app.replaceChildren(
      h(
        "main",
        { class: "optout wrap" },
        h("div", { class: "brand" }, brandMark(), "TRANSCRIPT REVIEW"),
        h(
          "h1",
          { class: "qtitle", tabindex: "-1", "data-focus": "" },
          w.title.replace("{label}", label),
        ),
        c.description ? h("p", { class: "lede" }, c.description) : null,
        h("p", { class: "lede" }, w.body),
        h(
          "p",
          { class: "fine" },
          `${plural(n, "pair")} on this topic left to review. ${progressText()}.`,
        ),
        h(
          "div",
          { class: "oo-acts" },
          h(
            "button",
            {
              class: "big primary",
              type: "button",
              onclick: () => continueWarning(then),
            },
            w.continueLabel,
            icon("right"),
          ),
          h(
            "button",
            {
              class: "big ghost",
              type: "button",
              onclick: () => skipOne(then),
            },
            w.skipOneLabel,
          ),
          n > 1
            ? h(
                "button",
                {
                  class: "big ghost",
                  type: "button",
                  onclick: () => skipCategory(c.id),
                },
                w.skipAllLabel.replace("{label}", label),
              )
            : null,
        ),
      ),
    );
  }
  function continueWarning(id: string) {
    const t = transcript(id);
    S.warned = id;
    openTranscript(S.list.indexOf(t));
  }
  function afterSkip(msg: string) {
    refreshList();
    changed();
    announce(`${msg} ${progressText()}.`);
    const i = firstPendingIndex();
    if (i === -1) finishFlow();
    else openTranscript(i);
  }
  function skipOne(id: string) {
    const t = transcript(id);
    ensure(t).optedOut = true;
    afterSkip("Skipped this pair.");
  }
  function skipCategory(cid: KoraCategory) {
    if (!S.optOutCats.includes(cid)) S.optOutCats.push(cid);
    for (const t of S.all)
      if (t.category === cid && res(t).status !== "done")
        ensure(t).optedOut = true;
    afterSkip(`Skipping all ${catLabel(cid)} pairs.`);
  }

  /* ---------- Finish ---------- */
  function renderFinish() {
    const ts = S.all;
    const done = ts.filter((t) => res(t).status === "done").length,
      skipped = ts.filter(
        (t) => res(t).optedOut && res(t).status !== "done",
      ).length;
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "TRANSCRIPT REVIEW"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          `${progressText()}.`,
        ),
        h(
          "p",
          { class: "lede" },
          `You ranked ${plural(done, "pair")}${skipped ? ` and skipped ${skipped}` : ""}. Your answers are saved.`,
        ),
        h(
          "ul",
          { class: "flist" },
          ts.map((t) => {
            const r = res(t),
              call = reviewed(r) ? callOf(t, r) : null;
            return h(
              "li",
              { class: "frow" },
              call
                ? h("span", { class: "mini-stamp " + call.cls }, call.text)
                : h("span", { class: "badge" }, "To do"),
              h(
                "span",
                { class: "qi-l" },
                h("span", { class: "qi-meta" }, catChip(t.category)),
                h("span", { class: "qi-snip" }, t.context.title || t.id),
              ),
            );
          }),
        ),
      ),
    );
  }

  return { needsWarning, renderFinish, renderWarning };
}
