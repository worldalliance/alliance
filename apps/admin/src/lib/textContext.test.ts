import { describe, expect, it } from "bun:test";
import { textContext } from "./textContext";

describe("textContext", () => {
  it("marks a side as cut only when text beyond it is left out", () => {
    expect(textContext({ text: "a typo here", start: 2, end: 6 })).toEqual({
      before: "a ",
      flagged: "typo",
      after: " here",
      cutBefore: false,
      cutAfter: false,
    });
  });

  it.each([
    [20, 20, false, false],
    [21, 20, true, false],
    [20, 21, false, true],
    [30, 30, true, true],
  ])(
    "with %i characters before and %i after, cutBefore is %s and cutAfter is %s",
    (beforeLength, afterLength, cutBefore, cutAfter) => {
      const text = `${"x".repeat(beforeLength)}typo${"y".repeat(afterLength)}`;
      const start = beforeLength;
      expect(textContext({ text, start, end: start + 4 })).toEqual({
        before: "x".repeat(Math.min(beforeLength, 20)),
        flagged: "typo",
        after: "y".repeat(Math.min(afterLength, 20)),
        cutBefore,
        cutAfter,
      });
    },
  );
});
