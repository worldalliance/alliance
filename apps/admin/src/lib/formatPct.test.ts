import { formatPct } from "./formatPct";

describe("formatPct", () => {
  it("rounds to two decimals and drops trailing zeros", () => {
    expect(formatPct(33.3333)).toBe("33.33%");
    expect(formatPct(50)).toBe("50%");
    expect(formatPct(12.5)).toBe("12.5%");
  });
});
