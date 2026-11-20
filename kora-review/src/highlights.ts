import type { KoraReaction } from "./types.gen.js";

/** One highlight as KORA's export describes it, before ids are attached. */
export type KoraHighlightSpan = {
  turnIndex: number;
  charStart: number;
  charEnd: number;
  text: string;
  valence: "like" | "dislike";
};

/** A reaction reduced to what decides passages: its turn, its span, and whether it is a 👎. */
export type ReactionSpan = {
  turn: number;
  start: number;
  end: number;
  down: boolean;
};

const byPosition = (
  a: { turn: number; start: number },
  b: { turn: number; start: number },
) => a.turn - b.turn || a.start - b.start;

/**
 * Within one turn, 👎 reactions that no 👍 or * interrupts are one passage, from the first's start to the last's
 * end, so the lines between are included. The review and KORA's export both take passages from here.
 */
export function thumbsDownPassages(
  reactions: ReactionSpan[],
): Omit<ReactionSpan, "down">[] {
  const out: Omit<ReactionSpan, "down">[] = [];
  let open: Omit<ReactionSpan, "down"> | null = null;
  for (const r of [...reactions].sort(byPosition)) {
    if (open && (!r.down || open.turn !== r.turn)) {
      out.push(open);
      open = null;
    }
    if (!r.down) continue;
    if (open) open.end = Math.max(open.end, r.end);
    else open = { turn: r.turn, start: r.start, end: r.end };
  }
  if (open) out.push(open);
  return out;
}

export const slicePoints = (s: string, start: number, end: number) =>
  [...s].slice(start, end).join("");

/** KORA's highlights from a rating's line reactions: each 👍 line is a like, each 👎 passage a dislike, * nothing. */
export function toKoraHighlights(
  reactions: KoraReaction[],
  turnText: (turnIndex: number) => string,
): KoraHighlightSpan[] {
  const spans = reactions.map((r) => ({
    turn: r.turnIndex,
    start: r.charStart,
    end: r.charEnd,
    down: r.kind === "down",
  }));
  const highlight = (
    s: Omit<ReactionSpan, "down">,
    valence: KoraHighlightSpan["valence"],
  ): KoraHighlightSpan => ({
    turnIndex: s.turn,
    charStart: s.start,
    charEnd: s.end,
    text: slicePoints(turnText(s.turn), s.start, s.end),
    valence,
  });
  return [
    ...thumbsDownPassages(spans).map((p) => highlight(p, "dislike")),
    ...spans
      .filter((_, i) => reactions[i]!.kind === "up")
      .map((s) => highlight(s, "like")),
  ].sort((a, b) => a.turnIndex - b.turnIndex || a.charStart - b.charStart);
}
