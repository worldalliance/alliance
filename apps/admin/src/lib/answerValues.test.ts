import { isEmptyAnswer, normalizeBoolean } from "./answerValues";

describe("isEmptyAnswer", () => {
  it("treats missing, blank, and empty containers as empty", () => {
    for (const value of [null, undefined, "", "  ", [], {}]) {
      expect(isEmptyAnswer(value)).toBe(true);
    }
  });

  it("keeps false and 0 as answers", () => {
    for (const value of [false, 0, "a", ["a"], { city: "a" }]) {
      expect(isEmptyAnswer(value)).toBe(false);
    }
  });
});

describe("normalizeBoolean", () => {
  it("reads stored booleans, strings, and 0/1", () => {
    expect(normalizeBoolean(true)).toBe(true);
    expect(normalizeBoolean("true")).toBe(true);
    expect(normalizeBoolean(1)).toBe(true);
    expect(normalizeBoolean(false)).toBe(false);
    expect(normalizeBoolean("false")).toBe(false);
    expect(normalizeBoolean(0)).toBe(false);
  });

  it("returns null for anything else", () => {
    expect(normalizeBoolean("yes")).toBeNull();
    expect(normalizeBoolean(null)).toBeNull();
  });
});
