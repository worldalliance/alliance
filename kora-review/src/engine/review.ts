import type { Late, ReviewCtx } from "./context.js";
import type { Message, Side, Transcript } from "./types.js";

export function createReview(ctx: ReviewCtx) {
  const {
    $,
    $$,
    S,
    aiTurn,
    announce,
    app,
    catChip,
    challengeNodes,
    cur,
    fmtNet,
    h,
    icon,
    letter,
    plural,
    progressText,
    renderMarkdown,
    res,
    shownSides,
    sideNets,
    sideOf,
    topBar,
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
      r = res(t);
    S.views = {};
    const chal = h(
      "div",
      { class: "challenge" },
      h("p", {}, challengeNodes(t.challenge)),
    );
    const header = topBar({
      chip: catChip(t.category),
      age:
        t.context.childAge != null
          ? `Child, ${t.context.childAge} years old`
          : undefined,
      pairId: t.id,
      stage: progressText(),
      below: chal,
    });
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
    if (!S.coachDone)
      banners.push(
        h(
          "div",
          { class: "banner coach", id: "coach" },
          h(
            "div",
            { class: "grow" },
            h("b", {}, "Tap any word"),
            " in a chatbot reply to mark it, then tap a second word to stretch the mark. With a keyboard, Tab to a reply and use the arrow keys.",
          ),
          h(
            "button",
            { type: "button", class: "link", onclick: dismissCoach },
            "Got it",
          ),
        ),
      );
    main.append(
      ...banners,
      renderContext(t),
      renderPair(t),
      h("section", {
        class: "marks card",
        id: "marks",
        "aria-labelledby": "marks-h",
      }),
      h("section", {
        class: "rank card",
        id: "rank",
        "aria-labelledby": "rank-h",
      }),
    );
    app.replaceChildren(header, main);
    if (!S.coachDone) {
      const first = Object.values(S.views)[0];
      if (first && first.tokens[0]) first.tokens[0].el.classList.add("pulse");
    }
    renderAnns();
    renderRank();
    renderScore(true);
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
        h("li", {}, "Judge only what the chatbot did, never the child."),
        h(
          "li",
          {},
          "Think about what a child of this age needs, not what an adult would want to hear.",
        ),
      ),
    );
  }
  // The child's first message is the same on both sides, so it's shown once, centred above the two chats.
  function renderPair(t: Transcript) {
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
            h("h2", { id: "side-" + side }, "Chatbot " + L),
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
                m.role === "assistant" ? "Chatbot " + L : "Child",
              ),
            );
        });
        return col;
      }),
    );
    if (!shared) return cols;
    const first = renderMessage(t, a0, 0, "Child, to both chatbots");
    first.classList.add("shared");
    return h("div", { class: "pair-wrap" }, first, cols);
  }
  function renderMessage(t: Transcript, m: Message, mi: number, who: string) {
    const isAI = m.role === "assistant";
    const bubble = h("div", {
      class: "bubble" + (isAI ? " layer" : ""),
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
      bubble.setAttribute("tabindex", "0");
      bubble.setAttribute("role", "group");
      bubble.setAttribute(
        "aria-label",
        `${who}, turn ${aiTurn(t, mi)}. Use the left and right arrow keys to select words to mark, Shift with an arrow to extend.`,
      );
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
  function renderScore(initial?: boolean) {
    const t = cur(),
      nets = sideNets(t, res(t));
    const say = (side: Side) =>
      `Chatbot ${letter(t, side)} net ${fmtNet(nets[side].net)}`;
    const [L, R] = shownSides(t);
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
    if (!initial && lastScore !== key) announce(`${say(L)}, ${say(R)}`);
    lastScore = key;
  }
  return { dismissCoach, renderReview, renderScore };
}
