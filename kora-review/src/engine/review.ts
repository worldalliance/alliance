import type { Late, ReviewCtx } from "./context.js";
import type { TimerId } from "./runtime.js";
import type { Message, Side, Transcript } from "./types.js";

const WORD_MS = 90,
  MAX_TYPING_MS = 3000,
  TYPING_PAUSE_MS = 500;

export function createReview(ctx: ReviewCtx) {
  const {
    $,
    $$,
    S,
    aiTurn,
    announce,
    app,
    cancel,
    catChip,
    cur,
    fmtNet,
    h,
    icon,
    later,
    letter,
    plural,
    progressText,
    reducedMotion,
    renderMarkdown,
    res,
    shownSides,
    sideNets,
    sideOf,
    topBar,
  } = ctx;
  const renderRank: Late["renderRank"] = (...args) =>
    ctx.late().renderRank(...args);
  const renderAnns: Late["renderAnns"] = (...args) =>
    ctx.late().renderAnns(...args);

  // A pair opened for the first time types the child's message in, and keeps the replies behind a button.
  let opening: {
    words: HTMLElement[];
    dots: HTMLElement;
    button: HTMLElement;
    hidden: HTMLElement[];
  } | null = null;
  let typer: TimerId | null = null;

  /* ---------- Review ---------- */
  function renderReview(slow = false) {
    const t = cur(),
      r = res(t);
    S.views = {};
    cancel(typer);
    opening = null;
    const rules = h(
      "p",
      { class: "rules" },
      "Remember to focus your review on the chatbot's responses (not the child's).",
    );
    const header = topBar({
      chip: catChip(t.category),
      age:
        t.context.childAge != null
          ? `Child, ${t.context.childAge} years old`
          : undefined,
      pairId: t.id,
      stage: progressText(),
      below: rules,
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
    const coach = S.coachDone
      ? null
      : h(
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
        );
    const { opener, cols } = renderPair(t);
    if (coach && !opener) banners.push(coach);
    const marks = h("section", {
      class: "marks",
      id: "marks",
      "aria-labelledby": "marks-h",
    });
    const rank = h("section", {
      class: "rank card",
      id: "rank",
      "aria-labelledby": "rank-h",
    });
    const showReplies = h(
      "button",
      {
        type: "button",
        class: "big primary show-replies",
        hidden: true,
        onclick: revealReplies,
      },
      "Grade the 2 chatbots' replies",
    );
    if (slow && opener) {
      const hidden = [coach, cols, marks, rank].filter((e) => e !== null);
      for (const e of hidden) e.hidden = true;
      const bubble = opener.querySelector<HTMLElement>(".bubble");
      const dots = h(
        "span",
        { class: "typing-dots", "aria-hidden": "true" },
        h("span"),
        h("span"),
        h("span"),
      );
      const words = bubble ? splitWords(bubble) : [];
      bubble?.prepend(dots);
      opening = {
        words,
        dots,
        button: showReplies,
        hidden,
      };
    }
    main.append(
      ...banners,
      h(
        "h1",
        { class: "sr", tabindex: "-1", "data-focus": "" },
        t.context.title || t.id,
      ),
      opener
        ? h(
            "div",
            { class: "pair-wrap" },
            opener,
            opening ? showReplies : null,
            coach,
            cols,
          )
        : cols,
      marks,
      rank,
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
  // Wraps each word of el's text in a span, hidden until the typing reaches it.
  function splitWords(el: HTMLElement) {
    const words: HTMLElement[] = [];
    const visit = (node: Node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType !== 3) {
          visit(child);
          continue;
        }
        const parts = (child.textContent ?? "").split(/(\s+)/).map((p) => {
          if (!p.trim()) return p;
          const w = h("span", { class: "tw" }, p);
          words.push(w);
          return w;
        });
        child.replaceWith(...parts);
      }
    };
    visit(el);
    return words;
  }
  // Types the child's message in once the pair is in view, then offers the replies.
  function playOpener() {
    const o = opening;
    if (!o) return;
    const done = () => {
      o.dots.remove();
      for (const w of o.words) w.classList.add("on");
      o.button.hidden = false;
      const a = o.button.ownerDocument.activeElement;
      if (!a || a === o.button.ownerDocument.body || app.contains(a))
        o.button.focus({ preventScroll: true });
    };
    if (reducedMotion() || !o.words.length) {
      done();
      return;
    }
    const step = Math.min(WORD_MS, MAX_TYPING_MS / o.words.length);
    let i = 0;
    const next = () => {
      if (i >= o.words.length) {
        done();
        return;
      }
      o.dots.remove();
      o.words[i++].classList.add("on");
      typer = later(next, step);
    };
    typer = later(next, TYPING_PAUSE_MS);
  }
  // A keyboard press (click detail 0) moves focus on to the first reply, where marking starts.
  function revealReplies(e: MouseEvent) {
    const o = opening;
    if (!o) return;
    opening = null;
    for (const el of o.hidden) {
      el.hidden = false;
      el.classList.add("fade-in");
    }
    o.button.remove();
    if (e.detail === 0)
      $$(".bubble[tabindex]")[0]?.focus({ preventScroll: true });
  }
  function dismissCoach() {
    S.coachDone = true;
    const c = $("coach");
    if (c) c.remove();
    $$(".tk.pulse").forEach((e) => e.classList.remove("pulse"));
  }
  // The child's first message is the same on both sides, so it's shown once, above the two chats.
  function renderPair(t: Transcript): {
    opener: HTMLElement | null;
    cols: HTMLElement;
  } {
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
    if (!shared) return { opener: null, cols };
    const age = t.context.childAge;
    const opener = h(
      "div",
      { class: "opener" },
      h(
        "p",
        { class: "opener-who" },
        h("b", {}, "Child"),
        age != null ? h("span", {}, `${age} years old`) : null,
      ),
      icon("chat"),
      renderMessage(t, a0, 0, null),
    );
    return { opener, cols };
  }
  function renderMessage(
    t: Transcript,
    m: Message,
    mi: number,
    who: string | null,
  ) {
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
      who ? h("div", { class: "who" }, who) : null,
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
      S.views[mi] = { ...view, bubble };
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
    const key = nets.a.net + "|" + nets.b.net;
    if (!initial && lastScore !== key) announce(`${say(L)}, ${say(R)}`);
    lastScore = key;
  }
  return { dismissCoach, playOpener, renderReview, renderScore };
}
