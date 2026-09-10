import { mockReactNative } from "../../mockReactNative";

mockReactNative();

// uniwind's `exports` names no subpath for its source, so the store is only
// reachable by file path. This resolve is read off that source rather than an
// API, and pinning it is what `apps/mobile/package.json` holds the version for.
const { UniwindStore } =
  await import("../../../../node_modules/uniwind/src/core/native/store");

function rule(className: string, property: string, value: number) {
  const entries: [string, () => unknown][] = [[property, () => value]];

  return {
    className,
    entries,
    minWidth: 0,
    maxWidth: Number.POSITIVE_INFINITY,
    orientation: null,
    theme: null,
    rtl: null,
    native: true,
    dependencies: null,
    index: 0,
    importantProperties: [],
    complexity: 0,
    active: null,
    focus: null,
    disabled: null,
    dataAttributes: null,
  };
}

function resolve(classNames: string) {
  UniwindStore.reinit(
    () => ({
      stylesheet: {
        "text-base": [rule("text-base", "fontSize", 17)],
        "leading-tight": [rule("leading-tight", "lineHeight", 1.25)],
        "leading-[26px]": [rule("leading-[26px]", "lineHeight", 26)],
      },
      vars: {},
      scopedVars: {},
    }),
    ["light"],
  );

  return UniwindStore.getStyles(classNames, undefined, undefined, {
    scopedTheme: null,
  }).styles;
}

describe("uniwind's line height resolve", () => {
  test("reads a unitless height as a multiple of the font size", () => {
    expect(resolve("text-base leading-tight")).toEqual({
      fontSize: 17,
      lineHeight: 21.25,
    });
  });

  test("answers NaN for a unitless height with no size to multiply", () => {
    expect(resolve("leading-tight")).toEqual({ lineHeight: NaN });
  });

  test("leaves a height carrying a unit alone", () => {
    expect(resolve("leading-[26px]")).toEqual({ lineHeight: 26 });
  });
});
