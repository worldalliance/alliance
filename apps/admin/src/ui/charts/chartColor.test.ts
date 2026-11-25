import { describe, expect, test } from "bun:test";
import { heatCellClass, sequenceColor } from "./chartColor";

describe("chart ramps", () => {
  test("a sequence runs from its first step to its last", () => {
    expect(sequenceColor(0)).toBe("var(--color-seq-1)");
    expect(sequenceColor(0.5)).toBe("var(--color-seq-4)");
    expect(sequenceColor(1)).toBe("var(--color-seq-7)");
  });

  test("a heat cell's text changes where the fill turns dark", () => {
    expect(heatCellClass(0)).toBe("bg-heat-1 text-fg");
    expect(heatCellClass(0.7)).toBe("bg-heat-5 text-fg");
    expect(heatCellClass(0.75)).toBe("bg-heat-6 text-accent-fg");
    expect(heatCellClass(1)).toBe("bg-heat-7 text-accent-fg");
  });

  test("a share outside 0 to 1 takes the nearest end", () => {
    expect(sequenceColor(-1)).toBe("var(--color-seq-1)");
    expect(heatCellClass(2)).toBe("bg-heat-7 text-accent-fg");
  });
});
