import { formatAiScore } from "./aiScore";

it("formats an AI probability as a whole percent, or -- without one", () => {
  expect(formatAiScore(0.876)).toBe("88%");
  expect(formatAiScore(null)).toBe("--");
  expect(formatAiScore(Number.NaN)).toBe("--");
});
