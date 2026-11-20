import type { ReactionListCtx } from "./context.js";
import { ICON, LABEL } from "./reactions.js";
import { ReactionKind, type Passage, type View } from "./types.js";

// "Your reactions": each reacted paragraph once, line for line as in the reply, its reacted lines picked out with
// their reaction beside them. Neighbouring reacted paragraphs share an entry, so a later entry in the same turn
// always skips some text and is headed "…".
export function createReactionList(ctx: ReactionListCtx) {
  const {
    $,
    $$,
    S,
    aiTurn,
    cur,
    h,
    icon,
    kindOn,
    lineText,
    lines,
    passages,
    renderReactions,
    rootEl,
    views,
  } = ctx;

  type Row = { line: number; kind: ReactionKind | null; inPassage: boolean };

  function rowsOf(v: View): Row[] {
    const ls = lines(v);
    const passage = new Map<number, number>();
    passages()
      .filter((p) => p.mi === v.mi)
      .forEach((p, n) => {
        const from = ls.findIndex((l) => l.first === p.first.first),
          to = ls.findIndex((l) => l.first === p.last.first);
        for (let i = from; i <= to; i++) passage.set(i, n);
      });
    return ls.map((l, i) => ({
      line: i,
      kind: kindOn(v.mi, l),
      inPassage: passage.has(i),
    }));
  }
  const blockOf = (v: View, line: number) =>
    v.tokens[lines(v)[line]!.first]!.blk;
  function groups(v: View): Row[][] {
    const ls = lines(v);
    const blk = (i: number) => blockOf(v, i);
    const rows = rowsOf(v);
    const out: Row[][] = [];
    let group: Row[] | null = null;
    let groupBlk = -1;
    for (let b = 0; b <= (ls.length ? blk(ls.length - 1) : -1); b++) {
      const block = rows.filter((r) => blk(r.line) === b);
      if (!block.some((r) => r.kind || r.inPassage)) {
        group = null;
        continue;
      }
      if (!group || groupBlk !== b - 1) {
        group = [];
        out.push(group);
      }
      group.push(...block);
      groupBlk = b;
    }
    return out;
  }

  function renderReactionList() {
    // The grading card quotes the first passage line for line, so a reflow that rewraps the reply rewraps it too.
    const quote = $("q3-quote"),
      first = passages()[0];
    if (quote && first) quote.replaceChildren(passageContext(first));
    const box = $("marks");
    if (!box) return;
    const heading = h(
      "h2",
      { class: "rank-h", id: "marks-h" },
      "Your reactions",
    );
    const items = views().flatMap((v) =>
      groups(v).map((rows, n) => entry(v, rows, n === 0)),
    );
    if (!items.length) {
      box.replaceChildren(
        heading,
        h(
          "p",
          { class: "dim" },
          "No reactions yet. This step is optional: scroll back up to the chatbot's replies and click a line to react. When done, complete the survey below.",
        ),
        h(
          "button",
          { type: "button", class: "big ghost back-btn", onclick: toReplies },
          icon("arrowUp"),
          "Back to the replies",
        ),
      );
      return;
    }
    box.replaceChildren(
      heading,
      h("ul", { class: "anns", "aria-labelledby": "marks-h" }, items),
    );
  }
  /** The paragraphs a 👎 passage spans, line for line, for the grading card. */
  function passageContext(p: Passage): HTMLElement {
    const v = S.views[p.mi]!;
    const from = blockOf(
        v,
        lines(v).findIndex((l) => l.first === p.first.first),
      ),
      to = blockOf(
        v,
        lines(v).findIndex((l) => l.first === p.last.first),
      );
    return paragraphs(
      v,
      rowsOf(v).filter((r) => {
        const b = blockOf(v, r.line);
        return b >= from && b <= to;
      }),
    );
  }
  function paragraphs(v: View, rows: Row[]): HTMLElement {
    const ls = lines(v);
    const paras: HTMLElement[] = [];
    let blk = -1;
    for (const r of rows) {
      const l = ls[r.line]!,
        b = v.tokens[l.first]!.blk;
      if (b !== blk) {
        paras.push(h("div", { class: "ctx-p" }));
        blk = b;
      }
      const text = lineText(v, l, l),
        tint = r.kind ?? (r.inPassage ? ReactionKind.Down : null);
      paras[paras.length - 1]!.append(
        tint
          ? h(
              "button",
              {
                type: "button",
                class: "ctx-line",
                onclick: () => jumpTo(v.mi, r.line),
              },
              h(
                "span",
                { class: "ctx-icon r-" + tint, "aria-hidden": "true" },
                r.kind ? icon(ICON[r.kind]) : null,
              ),
              r.kind ? h("span", { class: "sr" }, LABEL[r.kind] + ":") : null,
              h("mark", { class: "ctx-hl r-" + tint }, text),
            )
          : h(
              "span",
              { class: "ctx-line" },
              h("span", { class: "ctx-icon" }),
              text,
            ),
      );
    }
    return h("div", { class: "ctx" }, paras);
  }
  function entry(v: View, rows: Row[], firstInTurn: boolean) {
    return h(
      "li",
      { class: "ann-group" },
      firstInTurn
        ? h("span", { class: "dim" }, `Turn ${aiTurn(cur(), v.mi)}`)
        : h(
            "span",
            { class: "dim" },
            h("span", { "aria-hidden": "true" }, "…"),
            h("span", { class: "sr" }, `Later in turn ${aiTurn(cur(), v.mi)}`),
          ),
      paragraphs(v, rows),
    );
  }
  function toReplies() {
    const first = $$(".bubble[tabindex]")[0];
    if (!first) return;
    rootEl.scrollIntoView({ block: "start" });
    first.focus({ preventScroll: true });
  }
  function jumpTo(mi: number, line: number) {
    const v = S.views[mi];
    if (!v) return;
    const l = lines(v)[line];
    v.tokens[l?.first ?? 0]?.el.scrollIntoView({ block: "center" });
    S.kbLine = { mi, line };
    v.bubble.focus({ preventScroll: true });
    renderReactions();
  }

  return { passageContext, renderReactionList };
}
