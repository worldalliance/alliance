import { describe, expect, it } from "bun:test";
import { clipQuote, reasonText, reasonWords } from "../src/engine/ranking.js";

describe("reasonText", () => {
  it("saves the quote as a markdown blockquote line, then the reviewer's words", () => {
    expect(reasonText("asks for the address", "It was bad")).toBe(
      "> asks for the address\nIt was bad",
    );
  });

  it("saves only the reviewer's words when nothing is quoted", () => {
    expect(reasonText(null, "It was bad")).toBe("It was bad");
  });

  it("keeps a multi-line quote on one line", () => {
    expect(reasonText("one\n\ntwo", "bad")).toBe("> one two\nbad");
  });

  it("shortens a long quote so a full 140-character note still fits the export's 280", () => {
    const saved = reasonText("x".repeat(400), "n".repeat(140));
    expect(saved.length).toBeLessThanOrEqual(280);
    expect(clipQuote("x".repeat(400))).toEndWith("…");
  });
});

describe("reasonWords", () => {
  it("reads back the reviewer's words from a saved reason", () => {
    expect(reasonWords("> same\nIt was bad")).toBe("It was bad");
  });

  it("keeps an old-format reason whole", () => {
    expect(reasonWords("“same” It was bad")).toBe("“same” It was bad");
  });
});
