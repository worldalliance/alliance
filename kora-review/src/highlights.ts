import type { KoraReaction } from "./types.gen.js";

/** One highlight as KORA's export describes it, before ids are attached. */
export type KoraHighlightSpan = {
  turnIndex: number;
  charStart: number;
  charEnd: number;
  text: string;
  valence: "like" | "dislike";
};

const slicePoints = (s: string, start: number, end: number) =>
  [...s].slice(start, end).join("");

/**
 * KORA's highlights from a rating's line reactions: each 👍 line is a like; within one turn, 👎 lines not broken
 * by a 👍 or * are one dislike spanning them, lines between included, as the review shows them. * is not exported.
 */
export function toKoraHighlights(
  reactions: KoraReaction[],
  turnText: (turnIndex: number) => string,
): KoraHighlightSpan[] {
  const out: KoraHighlightSpan[] = [];
  const sorted = [...reactions].sort(
    (a, b) => a.turnIndex - b.turnIndex || a.charStart - b.charStart,
  );
  let run: KoraReaction[] = [];
  const close = () => {
    const first = run[0],
      last = run[run.length - 1];
    if (first && last)
      out.push({
        turnIndex: first.turnIndex,
        charStart: first.charStart,
        charEnd: last.charEnd,
        text: slicePoints(
          turnText(first.turnIndex),
          first.charStart,
          last.charEnd,
        ),
        valence: "dislike",
      });
    run = [];
  };
  for (const r of sorted) {
    if (run[0] && run[0].turnIndex !== r.turnIndex) close();
    if (r.kind === "down") {
      run.push(r);
      continue;
    }
    close();
    if (r.kind === "up")
      out.push({
        turnIndex: r.turnIndex,
        charStart: r.charStart,
        charEnd: r.charEnd,
        text: r.text,
        valence: "like",
      });
  }
  close();
  return out.sort(
    (a, b) => a.turnIndex - b.turnIndex || a.charStart - b.charStart,
  );
}
