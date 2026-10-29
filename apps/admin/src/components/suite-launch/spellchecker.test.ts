import { describe, expect, it } from "bun:test";
import { knownWordChecker } from "./spellchecker";

describe("knownWordChecker", () => {
  const isKnown = knownWordChecker({
    wordList: new Set(["wich", "theres", "belive", "rideshare"]),
    hunspellKnows: (word) => word === "which",
  });

  it("accepts a word either source knows", () => {
    expect(isKnown("rideshare")).toBe(true);
    expect(isKnown("which")).toBe(true);
  });

  it("leaves a typo-shaped list entry to Hunspell", () => {
    expect(isKnown("wich")).toBe(false);
    expect(isKnown("theres")).toBe(false);
    expect(isKnown("belive")).toBe(false);
  });
});
