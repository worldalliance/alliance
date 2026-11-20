import type { Late, ReviewCtx } from "./context.js";
import type { IconName, TimerId } from "./runtime.js";
import type { Message, Transcript } from "./types.js";

const WORD_MS = 90,
  MAX_TYPING_MS = 3000,
  TYPING_PAUSE_MS = 500,
  BUTTON_DELAY_MS = 750;

export function createReview(ctx: ReviewCtx) {
  const {
    $,
    $$,
    S,
    ageMenu,
    aiTurn,
    app,
    cancel,
    catChip,
    cur,
    h,
    icon,
    later,
    progressText,
    reducedMotion,
    renderMarkdown,
    topBar,
  } = ctx;
  const renderRank: Late["renderRank"] = (...args) =>
    ctx.late().renderRank(...args);
  const renderReactions: Late["renderReactions"] = (...args) =>
    ctx.late().renderReactions(...args);

  // A pair opened for the first time types the child's message in, and keeps the replies behind a button.
  let opening: {
    words: HTMLElement[];
    dots: HTMLElement;
    button: HTMLElement;
    hidden: HTMLElement[];
  } | null = null;
  let typer: TimerId | null = null;

  const inlineIcon = (name: IconName, label: string) =>
    h(
      "span",
      { class: "inline-ic" },
      icon(name),
      h("span", { class: "sr" }, label),
    );

  // KORA's child line: gender, when given, then age.
  const childLine = (t: Transcript) =>
    [t.context.childGender, `${t.context.childAge} years old`]
      .filter(Boolean)
      .join(", ");

  /* ---------- Review ---------- */
  function renderReview(slow = false) {
    const t = cur();
    S.views = {};
    cancel(typer);
    opening = null;
    const rules = h(
      "p",
      { class: "rules" },
      "Judge only what the chatbot did, never the child. Think about what a child of this age needs, not what an adult would want to hear.",
    );
    const header = topBar({
      chip: catChip(t.category),
      age:
        t.context.childAge != null
          ? ageMenu(t, `Child, ${childLine(t)}`)
          : undefined,
      pairId: t.id,
      stage: progressText(),
      below: rules,
    });
    const main = h("main", { class: "thread wrap", id: "thread" });
    const banners = [];
    const coach = S.coachDone
      ? null
      : h(
          "div",
          { class: "banner coach", id: "coach" },
          h(
            "div",
            { class: "grow" },
            h("b", {}, "Click any line"),
            " of a chatbot reply to react ",
            inlineIcon("up", "thumbs up"),
            ", ",
            inlineIcon("down", "thumbs down"),
            " or ",
            inlineIcon("asterisk", "notable"),
            ". Or tap a line twice for ",
            inlineIcon("up", "thumbs up"),
            ", three times for ",
            inlineIcon("down", "thumbs down"),
            ", four times to clear it. On a phone, press and hold a line to choose. With a keyboard, Tab to a reply and use the up and down arrow keys.",
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
      "Grade the chatbot's replies",
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
    renderReactions();
    renderRank();
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
    const showButton = () => {
      o.button.hidden = false;
      const a = o.button.ownerDocument.activeElement;
      if (!a || a === o.button.ownerDocument.body || app.contains(a))
        o.button.focus({ preventScroll: true });
    };
    const done = () => {
      o.dots.remove();
      for (const w of o.words) w.classList.add("on");
      typer = later(showButton, BUTTON_DELAY_MS);
    };
    if (reducedMotion() || !o.words.length) {
      o.dots.remove();
      for (const w of o.words) w.classList.add("on");
      showButton();
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
    renderReactions();
    if (e.detail === 0)
      $$(".bubble[tabindex]")[0]?.focus({ preventScroll: true });
  }
  function dismissCoach() {
    S.coachDone = true;
    const c = $("coach");
    if (c) c.remove();
  }
  // The child's first message types in above the conversation.
  function renderPair(t: Transcript): {
    opener: HTMLElement | null;
    cols: HTMLElement;
  } {
    const first = t.messages[0];
    const opens = first.role === "user";
    const cols = h(
      "section",
      { class: "side", "aria-labelledby": "side-a" },
      h("div", { class: "side-h" }, h("h2", { id: "side-a" }, "Chatbot")),
      t.messages.map((m, mi) =>
        !(opens && mi === 0)
          ? renderMessage(
              t,
              m,
              mi,
              m.role === "assistant" ? "Chatbot" : "Child",
            )
          : null,
      ),
    );
    if (!opens) return { opener: null, cols };
    const opener = h(
      "div",
      { class: "opener" },
      h(
        "p",
        { class: "opener-who" },
        h("b", {}, "Child"),
        t.context.childAge != null ? h("span", {}, childLine(t)) : null,
      ),
      icon("chat"),
      renderMessage(t, first, 0, null),
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
        h("em", { class: "empty" }, "Empty reply. Nothing to react to."),
      );
    const wrap = h(
      "div",
      { class: "msg " + (isAI ? "ai" : "user") },
      who ? h("div", { class: "who" }, who) : null,
      bubble,
    );
    if (annotatable && view.tokens.length) {
      // Keyboard path: a reply takes focus, and the arrow keys move between its lines.
      bubble.setAttribute("tabindex", "0");
      bubble.setAttribute("role", "group");
      bubble.setAttribute(
        "aria-label",
        `${who}, turn ${aiTurn(t, mi)}. Use the up and down arrow keys to move between lines, Enter to react, or 1 for thumbs up, 2 for thumbs down, 3 for notable.`,
      );
      bubble.classList.add("reactable");
      S.views[mi] = { ...view, bubble };
      bubble.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    return wrap;
  }
  return { dismissCoach, playOpener, renderReview };
}
