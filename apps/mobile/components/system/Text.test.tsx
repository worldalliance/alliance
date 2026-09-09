import { mockReactNative } from "../../mockReactNative";
import { mockStyleHooks } from "../../mockStyleHooks";

mockReactNative();

const resolve = mockStyleHooks();

const { default: Text } = await import("./Text");

const sans = { fontFamily: "Source Sans 3" };

// Called rather than rendered: `apps/mobile` has no renderer under `bun test`,
// and the primitive holds no hook the stubs above don't cover.
describe("Text", () => {
  beforeEach(() => {
    resolve.asked = null;
    resolve.answer = { lineHeight: 27 };
  });

  test("hands the rounded line height to the style prop", () => {
    expect(Text({ className: "text-xl leading-tight" }).props.style).toEqual([
      sans,
      { lineHeight: 27 },
      undefined,
    ]);
  });

  test("orders the rounded height ahead of the caller's style, which wins", () => {
    const style = { lineHeight: 21 };

    expect(
      Text({ className: "text-xl leading-tight", style }).props.style,
    ).toEqual([sans, { lineHeight: 27 }, style]);
  });

  test("sets no line height where no utility can set one", () => {
    expect(Text({ className: "text-xl" }).props.style).toEqual([
      sans,
      null,
      undefined,
    ]);
  });

  test("resolves the merged class names, size default and all", () => {
    Text({ className: "leading-tight" });

    expect(resolve.asked?.classNames).toBe("shrink text-base leading-tight");
  });
});
