import { describe, expect, test } from "bun:test";
import { folderName, toolSummary } from "./format";

describe("toolSummary", () => {
  test("takes the first non-empty string in the input", () => {
    expect(
      toolSummary({ replace_all: false, old: "", file_path: "/repo/a.txt" }),
    ).toBe("/repo/a.txt");
  });

  test("keeps the first line of a long string and shortens it", () => {
    expect(toolSummary({ command: `${"x".repeat(100)}\nsecond` })).toBe(
      `${"x".repeat(79)}…`,
    );
  });

  test("is empty for input with no string", () => {
    expect(toolSummary({ count: 3 })).toBe("");
    expect(toolSummary(null)).toBe("");
    expect(toolSummary("bare")).toBe("");
  });
});

describe("folderName", () => {
  test("is the last path segment", () => {
    expect(folderName("/Users/user/alliance/")).toBe("alliance");
    expect(folderName("/")).toBe("/");
  });
});
