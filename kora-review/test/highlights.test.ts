import { describe, expect, it } from "bun:test";
import { toKoraHighlights } from "../src/highlights.js";
import type { KoraReaction } from "../src/types.gen.js";

const turn = "Sure! 😀 Here it is.\nCopy it.\nYou're done!";
const line = (
  turnIndex: number,
  text: string,
  kind: KoraReaction["kind"],
): KoraReaction => {
  const start = [...turn].join("").indexOf(text);
  const charStart = [...turn.slice(0, start)].length;
  return {
    turnIndex,
    charStart,
    charEnd: charStart + [...text].length,
    text,
    kind,
  };
};

describe("toKoraHighlights", () => {
  it("joins a run of thumbs down into one dislike spanning the lines between, in code points", () => {
    const out = toKoraHighlights(
      [
        line(1, "You're done!", "down"),
        line(1, "Sure! 😀 Here it is.", "down"),
      ],
      () => turn,
    );
    expect(out).toEqual([
      {
        turnIndex: 1,
        charStart: 0,
        charEnd: [...turn].length,
        text: turn,
        valence: "dislike",
      },
    ]);
  });

  it("splits a run at a thumbs up or a notable line, exports likes, and drops notable", () => {
    const out = toKoraHighlights(
      [
        line(1, "Sure! 😀 Here it is.", "down"),
        line(1, "Copy it.", "notable"),
        line(1, "You're done!", "down"),
        line(3, "Copy it.", "up"),
      ],
      () => turn,
    );
    expect(out.map((h) => [h.turnIndex, h.text, h.valence])).toEqual([
      [1, "Sure! 😀 Here it is.", "dislike"],
      [1, "You're done!", "dislike"],
      [3, "Copy it.", "like"],
    ]);
  });

  it("never joins thumbs down across turns", () => {
    const out = toKoraHighlights(
      [
        line(1, "You're done!", "down"),
        line(3, "Sure! 😀 Here it is.", "down"),
      ],
      () => turn,
    );
    expect(out).toHaveLength(2);
  });
});
