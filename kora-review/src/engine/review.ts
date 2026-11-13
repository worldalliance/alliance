import type { Late, ReviewCtx } from "./context.js";
import type { Message, Result, Side, Transcript } from "./types.js";
import { q1Parts } from "./types.js";

export function createReview(ctx: ReviewCtx) {
  const {
    $,
    $$,
    Q0_LABEL,
    S,
    aiTurn,
    allReviewed,
    announce,
    app,
    callOf,
    catChip,
    challengeNodes,
    cur,
    fmtNet,
    go,
    goNext,
    h,
    icon,
    letter,
    nextPendingIndex,
    openTranscript,
    other,
    plural,
    progressText,
    renderMarkdown,
    res,
    shownSides,
    sideNets,
    sideOf,
    sign,
    vcls,
  } = ctx;
  const renderRank: Late["renderRank"] = (...args) =>
    ctx.late().renderRank(...args);
  const renderAnns: Late["renderAnns"] = (...args) =>
    ctx.late().renderAnns(...args);

  /* ---------- Review ---------- */
  function renderReview() {
    const t = cur(),
      r = res(t),
      locked = r.status === "done";
    S.views = {};
    const chal = h(
      "div",
      { class: "challenge" },
      h(
        "div",
        { class: "clabel" },
        h(
          "span",
          { class: "clabel-l" },
          t.tagline
            ? h("span", { class: "ctag" }, t.tagline)
            : h("span", {}, "The question"),
          t.context.childAge != null
            ? h(
                "span",
                { class: "cage" },
                `Child, ${t.context.childAge} years old`,
              )
            : null,
        ),
        h("span", { class: "prog", id: "prog" }, progressText()),
      ),
      h("p", {}, challengeNodes(t.challenge)),
    );
    const header = h(
      "header",
      { class: "rhead" },
      h(
        "div",
        { class: "wrap wide" },
        h(
          "div",
          { class: "rrow" },
          h(
            "button",
            { type: "button", class: "tbtn", onclick: () => go("queue") },
            icon("list"),
            "All pairs",
          ),
          catChip(t.category),
          h("span", { class: "grow" }),
          h(
            "div",
            { class: "score", id: "score", role: "img" },
            h("span", { class: "sv", id: "score-v" }),
            h("span", { class: "sn", id: "score-net" }),
          ),
        ),
        chal,
      ),
    );
    const main = h("main", { class: "thread wrap wide", id: "thread" });
    const banners = [];
    if (r.stale && (r.stale.moved || r.stale.lost))
      banners.push(
        h(
          "div",
          { class: "banner" },
          h(
            "div",
            { class: "grow" },
            h("b", {}, "Source changed. "),
            `This pair was edited after you marked it. ${plural(r.stale.moved, "mark")} moved to match, and ${r.stale.lost} couldn't be found${r.stale.lost ? " (listed as Not found)" : ""}.`,
          ),
        ),
      );
    if (!locked && !S.coachDone)
      banners.push(
        h(
          "div",
          { class: "banner coach", id: "coach" },
          h(
            "div",
            { class: "grow" },
            h("b", {}, "Tap any word"),
            " in an AI reply to mark it, then tap a second word to stretch the mark. With a keyboard, Tab to a reply and use the arrow keys.",
          ),
          h(
            "button",
            { type: "button", class: "link", onclick: dismissCoach },
            "Got it",
          ),
        ),
      );
    main.append(...banners, renderContext(t), renderPair(t, locked));
    if (!locked)
      main.append(
        h("section", {
          class: "rank card",
          id: "rank",
          "aria-labelledby": "rank-h",
        }),
      );
    main.append(
      h("section", { class: "reveal", id: "reveal", hidden: !locked }),
    );
    const footer = h(
      "footer",
      { class: "rfoot" },
      h(
        "div",
        { class: "wrap wide rfoot-in" },
        h(
          "button",
          {
            type: "button",
            class: "btn prev",
            title: "Previous (K)",
            disabled: S.idx === 0,
            onclick: () => openTranscript(S.idx - 1),
          },
          icon("left"),
          "Prev",
        ),
        h("span", { class: "savestat", id: "savestat" }),
        locked
          ? h(
              "button",
              { type: "button", class: "btn primary", onclick: goNext },
              nextPendingIndex() === -1
                ? allReviewed()
                  ? "Finish"
                  : "Next pair"
                : "Next pair",
              icon("right"),
            )
          : h(
              "button",
              {
                type: "button",
                class: "btn primary",
                onclick: () => {
                  const rank = $("rank");
                  rank?.scrollIntoView({ block: "start" });
                  rank?.querySelector("button")?.focus({ preventScroll: true });
                },
              },
              icon("scale"),
              "Ready to rank A vs B",
            ),
      ),
    );
    app.replaceChildren(header, main, footer);
    if (!locked && !S.coachDone) {
      const first = Object.values(S.views)[0];
      if (first && first.tokens[0]) first.tokens[0].el.classList.add("pulse");
    }
    renderAnns();
    renderRank();
    renderScore(true);
    renderReveal();
    paintSave();
  }
  function dismissCoach() {
    S.coachDone = true;
    const c = $("coach");
    if (c) c.remove();
    $$(".tk.pulse").forEach((e) => e.classList.remove("pulse"));
  }
  // The scenario every pair starts from: the child's background, then the situation, then the two rules.
  function renderContext(t: Transcript) {
    const c = t.context;
    return h(
      "section",
      { class: "ctx card" },
      h(
        "div",
        { class: "ctx-top" },
        h(
          "h1",
          { tabindex: "-1", "data-focus": "" },
          c.title || "The situation",
        ),
        c.childAge != null
          ? h("span", { class: "tag" }, `Child, age ${c.childAge}`)
          : null,
      ),
      c.background
        ? h(
            "details",
            { class: "ctx-more ctx-bg" },
            h("summary", {}, "About the child"),
            h("p", {}, c.background),
          )
        : null,
      c.scenario
        ? h(
            "details",
            { class: "ctx-more" },
            h("summary", {}, "The situation"),
            c.scenario.split(/\n\s*\n/).map((p: string) => h("p", {}, p)),
          )
        : null,
      h(
        "ul",
        { class: "rules" },
        h("li", {}, "Judge only what the AI did, never the child."),
        h(
          "li",
          {},
          "Think about what a child of this age needs, not what an adult would want to hear.",
        ),
      ),
    );
  }
  // The child's first message is the same on both sides, so it's shown once, centred above the two chats.
  function renderPair(t: Transcript, locked: boolean) {
    const a0 = t.messages[0],
      b0 = t.messages[t.pair.na];
    const shared =
      a0.role === "user" && b0.role === "user" && a0.content === b0.content;
    const skip = shared ? new Set([0, t.pair.na]) : new Set();
    const cols = h(
      "div",
      { class: "pair" },
      shownSides(t).map((side) => {
        const L = letter(t, side);
        const col = h(
          "section",
          { class: "side", "aria-labelledby": "side-" + side },
          h(
            "div",
            { class: "side-h" },
            h("h2", { id: "side-" + side }, "Chat with AI " + L),
            h("span", { class: "score sm", id: "score-" + side, role: "img" }),
          ),
        );
        t.messages.forEach((m, mi) => {
          if (sideOf(t, mi) === side && !skip.has(mi))
            col.append(
              renderMessage(
                t,
                m,
                mi,
                locked,
                m.role === "assistant" ? "AI " + L : "Child",
              ),
            );
        });
        return col;
      }),
    );
    if (!shared) return cols;
    const first = renderMessage(t, a0, 0, locked, "Child, to both AIs");
    first.classList.add("shared");
    return h("div", { class: "pair-wrap" }, first, cols);
  }
  function renderMessage(
    t: Transcript,
    m: Message,
    mi: number,
    locked: boolean,
    who: string,
  ) {
    const isAI = m.role === "assistant";
    const bubble = h("div", {
      class:
        "bubble" + (isAI ? " layer" : "") + (isAI && locked ? " locked" : ""),
    });
    const annotatable = isAI && m.content.trim().length > 0;
    const view = renderMarkdown(bubble, m.content, mi, annotatable);
    if (!m.content.trim())
      bubble.append(
        h("em", { class: "empty" }, "Empty reply. Nothing to mark."),
      );
    const wrap = h(
      "div",
      { class: "msg " + (isAI ? "ai" : "user") },
      h("div", { class: "who" }, who),
      bubble,
    );
    if (annotatable && view.tokens.length) {
      // Keyboard path: a reply takes focus, and the arrow keys select words in it.
      if (!locked) {
        bubble.setAttribute("tabindex", "0");
        bubble.setAttribute("role", "group");
        bubble.setAttribute(
          "aria-label",
          `${who}, turn ${aiTurn(t, mi)}. Use the left and right arrow keys to select words to mark, Shift with an arrow to extend.`,
        );
      }
      const list = h("ul", {
        class: "anns",
        "aria-label": `Marks on ${who}, turn ${aiTurn(t, mi)}`,
      });
      wrap.append(list);
      S.views[mi] = { ...view, bubble, list };
      bubble.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    return wrap;
  }
  let lastScore: string | null = null;
  // A pair has a live score per AI: on each column's heading, and both together in the header chip.
  function renderScore(initial?: boolean) {
    const el = $("score");
    if (!el) return;
    const t = cur(),
      nets = sideNets(t, res(t));
    const part = (side: Side) => {
      const s = sign(nets[side].net);
      return [
        h("b", { class: "sl" }, letter(t, side)),
        h(
          "span",
          { class: "sv " + vcls(s) },
          icon(s > 0 ? "up" : s < 0 ? "down" : "scale"),
        ),
        h("span", { class: "sn" }, `(${fmtNet(nets[side].net)})`),
      ];
    };
    const [L, R] = shownSides(t);
    el.className = "score pairscore";
    el.replaceChildren(
      ...part(L),
      h("span", { class: "dim", "aria-hidden": "true" }, "·"),
      ...part(R),
    );
    const say = (side: Side) =>
      `AI ${letter(t, side)} net ${fmtNet(nets[side].net)}`;
    el.setAttribute("aria-label", `${say(L)}, ${say(R)}`);
    for (const side of [L, R]) {
      const c = $("score-" + side);
      if (!c) continue;
      const s = sign(nets[side].net);
      c.className = "score sm " + vcls(s);
      c.replaceChildren(
        h(
          "span",
          { class: "sv" },
          icon(s > 0 ? "up" : s < 0 ? "down" : "scale"),
        ),
        h("span", { class: "sn" }, `(${fmtNet(nets[side].net)})`),
      );
      c.setAttribute("aria-label", say(side));
    }
    const key = nets.a.net + "|" + nets.b.net;
    if (!initial && lastScore !== key) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
      announce(`${say(L)}, ${say(R)}`);
    }
    lastScore = key;
  }
  function renderReveal() {
    const box = $("reveal");
    if (!box) return;
    const t = cur(),
      r = res(t);
    box.hidden = r.status !== "done";
    if (box.hidden) return;
    const call = callOf(t, r);
    box.replaceChildren(
      h(
        "div",
        { class: "stamp-wrap" },
        h("div", { class: "stamp " + call.cls }, h("b", {}, call.text)),
      ),
      pairSummary(t, r),
    );
  }
  function pairSummary(t: Transcript, r: Result) {
    const j = r.answers,
      failing = j.q1 ? other(q1Parts(j.q1).side) : null;
    const safetyLabel = (side: Side) => {
      const v = side === "a" ? j.q0_a : j.q0_b;
      return v ? Q0_LABEL[v] : "—";
    };
    return h(
      "ul",
      { class: "psum" },
      shownSides(t).map((side) =>
        h("li", {}, h("b", {}, `AI ${letter(t, side)}: `), safetyLabel(side)),
      ),
      failing
        ? h(
            "li",
            {},
            h("b", {}, `AI ${letter(t, failing)} `),
            j.q2_turn === "none"
              ? "has no real problem, it is just less good."
              : `goes wrong at turn ${j.q2_turn}.`,
          )
        : null,
      j.q3_text ? h("li", { class: "dim" }, j.q3_text) : null,
    );
  }
  // The footer's middle slot: the locked call, or nothing. Save status is the host's to show.
  function paintSave() {
    const el = $("savestat");
    if (!el) return;
    const r = S.screen === "review" && cur() ? res(cur()) : null;
    el.textContent = r && r.status === "done" ? callOf(cur(), r).text : "";
  }

  return { dismissCoach, renderReview, renderScore };
}
