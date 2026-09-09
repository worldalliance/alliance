import {
  canSetLineHeight,
  forgetLineHeightWarnings,
  lineHeightForWholePoints,
  pinnableLineHeight,
  wholePointStyle,
} from "./lineHeight";

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

describe("pinnableLineHeight", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    forgetLineHeightWarnings();
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  test.each([
    "shrink leading-5 active:leading-6",
    "shrink leading-tight disabled:leading-none",
    "shrink leading-5 dark:active:leading-6",
    "shrink leading-5 data-[selected=true]:leading-6",
    "shrink leading-5 data-selected:leading-6",
    "shrink leading-5 [&:active]:leading-6",
    "shrink leading-5 [&[data-selected=true]]:leading-6",
    "shrink leading-5 [&[data-selected]]:leading-6",
    "shrink active:leading-(--custom)",
    "shrink active:[line-height:22px]",
    "shrink text-base active:text-lg/8",
    // A variant font size moves a unitless leading with it, and telling one
    // `text-*` from another means tracking every name global.css adds.
    "shrink leading-tight active:text-2xl",
    "shrink leading-5 active:text-zinc-500",
    // uniwind ignores a hover rule and a variant that sets no height, but a
    // class string naming a state gives its height up rather than guessing
    // which states uniwind reads.
    "shrink leading-5 [&:hover]:leading-6",
    "shrink leading-tight active:opacity-50",
  ])("drops the height under %s and warns", (classNames) => {
    expect(pinnableLineHeight({ lineHeight: 20, classNames })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test.each([
    "",
    "shrink text-base",
    "shrink text-sm leading-5 text-zinc-500",
    "shrink leading-tight dark:leading-6",
    "shrink leading-tight md:text-lg",
    "shrink inactive:leading-6",
    "shrink active-tab:leading-6",
    // uniwind builds a Text's state without `isFocused`, and drops a `group-*`
    // rule before it reaches the stylesheet, so neither pass sees either one.
    "shrink leading-5 focus:leading-6",
    "shrink leading-tight focus:text-lg",
    "shrink leading-tight group-active:text-lg",
  ])("pins the height under %s", (classNames) => {
    expect(pinnableLineHeight({ lineHeight: 20, classNames })).toEqual({
      lineHeight: 20,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  test.each([undefined, NaN])(
    "warns on a %s height a variant was the only thing setting",
    (lineHeight) => {
      expect(
        pinnableLineHeight({
          lineHeight,
          classNames: "shrink active:leading-6",
        }),
      ).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  test.each([undefined, NaN])(
    "drops a %s height with no variant to explain it, without warning",
    (lineHeight) => {
      expect(
        pinnableLineHeight({ lineHeight, classNames: "shrink text-base" }),
      ).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    },
  );

  test("warns once per class string, not once per render", () => {
    const classNames = "shrink leading-5 active:leading-6";

    pinnableLineHeight({ lineHeight: 20, classNames });
    pinnableLineHeight({ lineHeight: 20, classNames });

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("canSetLineHeight", () => {
  test.each([
    "shrink leading-5",
    "shrink leading-tight",
    "shrink leading-[22px]",
    "shrink leading-(--custom)",
    "shrink text-base/7",
    "shrink text-sm/[22px]",
    "shrink [line-height:22px]",
    "shrink active:leading-6",
    "shrink md:leading-6",
    // An opacity modifier sets no height, and resolving one costs a cache hit.
    "shrink text-white/70",
  ])("says %s can", (classNames) => {
    expect(canSetLineHeight(classNames)).toBe(true);
  });

  test.each([
    "",
    "shrink text-base",
    "shrink text-2xl text-zinc-900",
    "shrink text-sm text-zinc-500 underline",
    "shrink active:opacity-50",
    // Only a `text-*` utility carries a line-height modifier, so the slash in a
    // fraction or another utility's opacity is not one.
    "shrink w-1/2",
    "shrink bg-black/50",
    "shrink border-zinc-200/50 active:opacity-50",
  ])("says %s can't", (classNames) => {
    expect(canSetLineHeight(classNames)).toBe(false);
  });
});
