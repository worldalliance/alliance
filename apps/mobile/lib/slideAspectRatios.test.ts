import { describe, expect, it } from "bun:test";
import { withSlideAspectRatio } from "./slideAspectRatios";

describe("withSlideAspectRatio", () => {
  it("keeps the same state when a slide reports the ratio it already has", () => {
    const ratios = { 0: 1.5 };
    expect(withSlideAspectRatio(ratios, { slide: 0, ratio: 1.5 })).toBe(ratios);
  });

  it("records a slide's first ratio", () => {
    expect(withSlideAspectRatio({ 0: 1.5 }, { slide: 1, ratio: 2 })).toEqual({
      0: 1.5,
      1: 2,
    });
  });

  it("replaces a slide's changed ratio", () => {
    expect(withSlideAspectRatio({ 0: 1.5 }, { slide: 0, ratio: 2 })).toEqual({
      0: 2,
    });
  });
});
