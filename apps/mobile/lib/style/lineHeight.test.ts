import { lineHeightForWholePoints, wholePointStyle } from "./lineHeight";

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

describe("wholePointStyle", () => {
  const classNames = "text-base leading-tight";
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  test("rounds the height and keeps the rest of the style", () => {
    expect(
      wholePointStyle({
        style: { fontSize: 16, lineHeight: 25.5 },
        fontScale: 1,
        classNames,
      }),
    ).toEqual({ fontSize: 16, lineHeight: 26 });
  });

  test("leaves a style that sets no line height alone", () => {
    const style = { fontSize: 16 };

    expect(wholePointStyle({ style, fontScale: 1, classNames })).toBe(style);
  });

  test.each([NaN, Infinity])("drops a %s height and warns", (lineHeight) => {
    const rounded = wholePointStyle({
      style: { fontSize: 16, lineHeight },
      fontScale: 1,
      classNames,
    });

    expect(rounded).not.toHaveProperty("lineHeight");
    expect(rounded.fontSize).toBe(16);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("drops the height where the scale can't divide", () => {
    expect(
      wholePointStyle({
        style: { fontSize: 16, lineHeight: 24 },
        fontScale: 0,
        classNames,
      }),
    ).not.toHaveProperty("lineHeight");
  });
});
