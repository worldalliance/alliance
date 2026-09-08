import { lineHeightForWholePoints } from "./lineHeight";

const IOS_TEXT_SIZE_SCALES = [
  0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143,
  3.571,
];
// A sweep rather than the theme's own values: the guarantee holds for any line
// height, so pinning the list to today's `text-*` sizes would only go stale.
const LINE_HEIGHTS = Array.from({ length: 161 }, (_, i) => 12 + i * 0.125);

describe("lineHeightForWholePoints", () => {
  test("rounds up at the default text size", () => {
    expect(lineHeightForWholePoints({ lineHeight: 25.5, fontScale: 1 })).toBe(
      26,
    );
  });

  test("leaves a whole line height alone", () => {
    expect(lineHeightForWholePoints({ lineHeight: 24, fontScale: 1 })).toBe(24);
  });

  test("is whole once the OS text size scales it back up", () => {
    for (const fontScale of IOS_TEXT_SIZE_SCALES) {
      for (const lineHeight of LINE_HEIGHTS) {
        const rounded = lineHeightForWholePoints({ lineHeight, fontScale });
        const scaled = rounded * fontScale;

        expect(scaled).toBeCloseTo(Math.round(scaled), 9);
        expect(scaled).toBeGreaterThanOrEqual(lineHeight * fontScale);
      }
    }
  });

  test("leaves its own result alone", () => {
    for (const fontScale of IOS_TEXT_SIZE_SCALES) {
      for (const lineHeight of LINE_HEIGHTS) {
        const rounded = lineHeightForWholePoints({ lineHeight, fontScale });

        expect(
          lineHeightForWholePoints({ lineHeight: rounded, fontScale }),
        ).toBe(rounded);
      }
    }
  });
});
