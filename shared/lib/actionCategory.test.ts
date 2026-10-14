import { describe, expect, it } from "bun:test";
import { ACTION_CATEGORIES, sortActionCategories } from "./actionCategory";

describe("sortActionCategories", () => {
  it("orders categories by display order", () => {
    expect(sortActionCategories(["meta", "democracy", "environment"])).toEqual([
      "environment",
      "democracy",
      "meta",
    ]);
  });

  it("returns an empty list for no categories", () => {
    expect(sortActionCategories([])).toEqual([]);
  });

  it("lists every category once", () => {
    expect(sortActionCategories([...ACTION_CATEGORIES].reverse())).toEqual(
      ACTION_CATEGORIES,
    );
  });
});
