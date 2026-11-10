import type { QueueCtx } from "./context.js";
import type { State } from "./types.js";

export function createQueue(ctx: QueueCtx) {
  const {
    S,
    app,
    brandMark,
    callOf,
    catChip,
    catLabel,
    finishFlow,
    firstPendingIndex,
    h,
    hueOf,
    icon,
    openTranscript,
    plural,
    progressText,
    res,
    reviewed,
    reviewedCount,
  } = ctx;

  /* ---------- Queue ---------- */
  function renderQueue() {
    const ts = S.list,
      done = reviewedCount(),
      total = S.all.length;
    const cats = [...new Set(ts.map((t) => t.category))];
    const f = S.filter;
    if (f.category !== "all" && !cats.some((c) => c === f.category))
      f.category = "all";
    const rows = ts
      .map((t, i) => ({ t, i, r: res(t) }))
      .filter(
        ({ t, r }) =>
          (f.status === "all" || (f.status === "done") === reviewed(r)) &&
          (f.category === "all" || t.category === f.category),
      );
    const segBtn = (val: State["filter"]["status"], label: string) =>
      h(
        "button",
        {
          type: "button",
          "aria-pressed": String(f.status === val),
          onclick: () => {
            f.status = val;
            renderQueue();
          },
        },
        label,
      );
    const catBtn = (val: State["filter"]["category"], label: string) =>
      h(
        "button",
        {
          type: "button",
          class: "chip",
          "aria-pressed": String(f.category === val),
          onclick: () => {
            f.category = val;
            renderQueue();
          },
        },
        val === "all"
          ? null
          : h("span", {
              class: "dot",
              style: `--h:${hueOf(val)}`,
              "aria-hidden": "true",
            }),
        label,
      );
    const nextIdx = firstPendingIndex();
    const skippedOne = S.all.filter(
      (t) => res(t).optedOut && !S.optOutCats.includes(t.category),
    ).length;
    app.replaceChildren(
      h(
        "header",
        { class: "qhead" },
        h(
          "div",
          { class: "wrap" },
          h("div", { class: "qtop" }, brandMark()),
          h(
            "h1",
            { class: "qtitle", tabindex: "-1", "data-focus": "" },
            "Your pairs",
          ),
          S.optOutCats.length
            ? h(
                "p",
                { class: "fine" },
                "Skipping: " + S.optOutCats.map(catLabel).join(", "),
              )
            : null,
          skippedOne
            ? h(
                "p",
                { class: "fine" },
                `Skipped ${plural(skippedOne, "pair")}.`,
              )
            : null,
          h(
            "div",
            { class: "meter" },
            h(
              "div",
              {
                class: "meter-bar",
                role: "progressbar",
                "aria-valuemin": 0,
                "aria-valuemax": total,
                "aria-valuenow": done,
                "aria-label": "Pairs reviewed",
              },
              h("i", { style: `width:${total ? (done / total) * 100 : 0}%` }),
            ),
            h("span", {}, progressText()),
          ),
          h(
            "div",
            { class: "qacts" },
            nextIdx === -1
              ? h(
                  "button",
                  { type: "button", class: "btn primary", onclick: finishFlow },
                  S.isDone ? "See summary" : "Finish",
                  icon("right"),
                )
              : h(
                  "button",
                  {
                    type: "button",
                    class: "btn primary",
                    onclick: () => openTranscript(nextIdx),
                  },
                  done ? "Continue reviewing" : "Start reviewing",
                  icon("right"),
                ),
          ),
        ),
      ),
      h(
        "main",
        { class: "wrap qmain" },
        h(
          "div",
          { class: "filters" },
          h(
            "div",
            { class: "seg", role: "group", "aria-label": "Filter by status" },
            segBtn("all", "All"),
            segBtn("pending", "To do"),
            segBtn("done", "Reviewed"),
          ),
          cats.length > 1
            ? h(
                "div",
                {
                  class: "cats",
                  role: "group",
                  "aria-label": "Filter by category",
                },
                catBtn("all", "All categories"),
                cats.map((c) => catBtn(c, catLabel(c))),
              )
            : null,
        ),
        rows.length
          ? h(
              "ul",
              { class: "qlist" },
              rows.map(({ t, i, r }) => {
                const call = reviewed(r) ? callOf(t, r) : null;
                const badge = call
                  ? h(
                      "span",
                      { class: "mini-stamp " + call.cls },
                      icon(call.icon),
                      call.text,
                    )
                  : r.annotations.length
                    ? h(
                        "span",
                        { class: "badge wip" },
                        plural(r.annotations.length, "mark"),
                      )
                    : h(
                        "span",
                        { class: "badge" },
                        r.startedAt ? "Started" : "New",
                      );
                return h(
                  "li",
                  {},
                  h(
                    "button",
                    {
                      type: "button",
                      class: "qi",
                      onclick: () => openTranscript(i),
                    },
                    h(
                      "span",
                      { class: "qi-l" },
                      h("span", { class: "qi-meta" }, catChip(t.category)),
                      h("span", { class: "qi-snip" }, t.context.title || t.id),
                    ),
                    badge,
                  ),
                );
              }),
            )
          : h("p", { class: "empty-note" }, "Nothing matches these filters."),
      ),
    );
  }

  return { renderQueue };
}
