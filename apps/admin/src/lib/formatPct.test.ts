import { formatPct, formatRatioAsPct } from "./formatPct";

describe("formatPct", () => {
  it("rounds to two decimals and drops trailing zeros", () => {
    expect(formatPct(33.3333)).toBe("33.33%");
    expect(formatPct(50)).toBe("50%");
    expect(formatPct(12.5)).toBe("12.5%");
  });
});

describe("formatRatioAsPct", () => {
  it("reads a 0–1 ratio as a percent to hundredths", () => {
    expect(formatRatioAsPct(0.5)).toBe("50.00%");
    expect(formatRatioAsPct(1 / 3)).toBe("33.33%");
  });
});
