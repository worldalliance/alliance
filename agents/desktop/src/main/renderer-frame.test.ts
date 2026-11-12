import { describe, expect, test } from "bun:test";
import { fromRendererOnly, isRendererFrame } from "./renderer-frame";

const rendererUrl = "app://renderer/index.html";
const trusted = (frame: { parent: unknown; url: string } | null) =>
  isRendererFrame({ frame, rendererUrl });

describe("isRendererFrame", () => {
  test("accepts the renderer's top-level page", () => {
    expect(trusted({ parent: null, url: "app://renderer/index.html" })).toBe(
      true,
    );
  });

  test("refuses a subframe, another host or scheme, and a destroyed frame", () => {
    const top = { parent: null, url: rendererUrl };
    expect(trusted({ parent: top, url: rendererUrl })).toBe(false);
    expect(trusted({ parent: null, url: "app://other/index.html" })).toBe(
      false,
    );
    expect(trusted({ parent: null, url: "file:///index.html" })).toBe(false);
    expect(trusted({ parent: null, url: "" })).toBe(false);
    expect(trusted(null)).toBe(false);
  });

  test("accepts the dev server's page under its own URL", () => {
    expect(
      isRendererFrame({
        frame: { parent: null, url: "http://localhost:5173/#x" },
        rendererUrl: "http://localhost:5173/",
      }),
    ).toBe(true);
  });
});

describe("fromRendererOnly", () => {
  const guarded = fromRendererOnly({
    rendererUrl,
    listener: (_event: unknown, arg: string) => `ran ${arg}`,
    refuse: () => "refused",
  });

  test("runs the listener for the renderer's page and refuses any other frame", () => {
    const top = { parent: null, url: rendererUrl };
    expect(guarded({ senderFrame: top }, "a")).toBe("ran a");
    expect(
      guarded({ senderFrame: { parent: top, url: rendererUrl } }, "a"),
    ).toBe("refused");
    expect(guarded({ senderFrame: null }, "a")).toBe("refused");
  });
});
