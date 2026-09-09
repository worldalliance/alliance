import { mockReactNative } from "../../mockReactNative";
import { mockStyleHooks } from "../../mockStyleHooks";

const platform = mockReactNative();
const resolve = mockStyleHooks();

const { forgetLineHeightWarnings } = await import("./lineHeight");
const { useWholePointLineHeight } = await import("./useWholePointLineHeight");

const classNames = "shrink text-xl leading-tight";

describe("useWholePointLineHeight", () => {
  beforeEach(() => {
    forgetLineHeightWarnings();
    resolve.asked = null;
    resolve.answer = { lineHeight: 27 };
  });

  afterEach(() => {
    platform.OS = "ios";
  });

  test("pins the height the class names resolve to, at the OS text size", () => {
    expect(useWholePointLineHeight(classNames)).toEqual({ lineHeight: 27 });
    expect(resolve.asked).toEqual({ classNames, fontScale: 1.235 });
  });

  test("skips the resolve where no utility can set a height", () => {
    expect(useWholePointLineHeight("shrink text-xl")).toBeNull();
    expect(resolve.asked?.classNames).toBe("");
  });

  test("skips the resolve where a variant could move the height", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      useWholePointLineHeight("shrink leading-5 active:leading-6"),
    ).toBeNull();
    expect(resolve.asked?.classNames).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  test("says nothing about a variant that sets no height either", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(useWholePointLineHeight("shrink active:opacity-50")).toBeNull();
    expect(resolve.asked?.classNames).toBe("");
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  test.each(["ios", "android"])("rounds on %s", (OS) => {
    platform.OS = OS;

    expect(useWholePointLineHeight(classNames)).toEqual({ lineHeight: 27 });
    expect(resolve.asked?.classNames).toBe(classNames);
  });

  test("skips the resolve on web", () => {
    platform.OS = "web";

    expect(useWholePointLineHeight(classNames)).toBeNull();
    expect(resolve.asked?.classNames).toBe("");
  });

  test("says nothing about a variant on web", () => {
    platform.OS = "web";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      useWholePointLineHeight("shrink leading-5 active:leading-6"),
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  test("pins nothing where the class names resolve to no height", () => {
    resolve.answer = {};

    expect(useWholePointLineHeight("shrink text-base/7")).toBeNull();
    expect(resolve.asked?.classNames).toBe("shrink text-base/7");
  });
});
