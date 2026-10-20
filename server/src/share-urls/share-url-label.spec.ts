import { describe, expect, it } from "bun:test";
import { normalizeShareUrlLabel } from "./share-url-label";

describe("normalizeShareUrlLabel", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeShareUrlLabel("  Alice  ")).toBe("Alice");
  });

  it("stores a missing, empty or whitespace-only label as null", () => {
    expect(normalizeShareUrlLabel(undefined)).toBeNull();
    expect(normalizeShareUrlLabel("")).toBeNull();
    expect(normalizeShareUrlLabel(" \t\n ")).toBeNull();
  });
});
