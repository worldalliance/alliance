import { describe, expect, it } from "bun:test";
import { shownLabel } from "./shownLabel";

describe("shownLabel", () => {
  it("keeps a label with text, untrimmed", () => {
    expect(shownLabel({ label: " Your name " })).toBe(" Your name ");
  });

  it("treats a missing, empty or blank label as none", () => {
    expect(shownLabel({ label: null })).toBeNull();
    expect(shownLabel({ label: "" })).toBeNull();
    expect(shownLabel({ label: " \n " })).toBeNull();
  });
});
