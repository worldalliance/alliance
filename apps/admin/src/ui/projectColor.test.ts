import { describe, expect, it } from "bun:test";
import { projectColor } from "./projectColor";

describe("projectColor", () => {
  it("gives a project the same colour every time", () => {
    expect(projectColor(12)).toBe(projectColor(12));
  });

  it("names one category's classes and value together", () => {
    for (let id = 1; id <= 50; id++) {
      const { solid, soft, border, value } = projectColor(id);
      const n = /^bg-cat-([1-6])$/.exec(solid)?.[1];
      expect(n).toBeDefined();
      expect<string>(soft).toBe(`bg-cat-${n}-soft`);
      expect<string>(border).toBe(`border-cat-${n}`);
      expect<string>(value).toBe(`var(--color-cat-${n})`);
    }
  });

  it("spreads projects over all six categories", () => {
    const used = new Set(
      Array.from({ length: 50 }, (_, index) => projectColor(index + 1).solid),
    );
    expect(used.size).toBe(6);
  });
});
