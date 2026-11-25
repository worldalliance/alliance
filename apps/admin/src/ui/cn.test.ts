import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cn } from "./cn";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const tokenNames = (prefix: string) => [
  ...new Set(
    [...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, "g"))]
      .map(([, name]) => name)
      .filter((name) => !name.includes("--")),
  ),
];

describe("cn", () => {
  test("keeps an admin text size beside a text colour", () => {
    expect(cn("text-body text-fg")).toBe("text-body text-fg");
  });

  test("lets a later admin token override an earlier one", () => {
    expect(cn("text-body", "text-caption")).toBe("text-caption");
    expect(cn("h-control", "h-control-sm")).toBe("h-control-sm");
    expect(cn("px-3", "px-cell")).toBe("px-cell");
    expect(cn("rounded-md", "rounded-card")).toBe("rounded-card");
    expect(cn("shadow-lg", "shadow-pop")).toBe("shadow-pop");
    expect(cn("duration-150", "duration-fast")).toBe("duration-fast");
  });

  // A token `cn` doesn't know is read as another kind of class and dropped.
  test.each([
    ["text", "text", "sm", "text-fg"],
    ["spacing", "p", "0", "text-fg"],
    ["radius", "rounded", "md", "text-fg"],
    ["shadow", "shadow", "lg", "text-fg"],
    ["ease", "ease", "linear", "text-fg"],
  ])(
    "knows every --%s token in index.css",
    (prefix, utility, other, beside) => {
      const names = tokenNames(prefix);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(cn(`${utility}-${other}`, `${utility}-${name}`, beside)).toBe(
          `${utility}-${name} ${beside}`,
        );
      }
    },
  );
});
