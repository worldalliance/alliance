import { describe, expect, test } from "bun:test";
import { folderName, toolSummary } from "./format";

describe("toolSummary", () => {
  test("takes the first string with text in the input", () => {
    expect(
      toolSummary({ replace_all: false, old: "", file_path: "/repo/a.txt" }),
    ).toBe("/repo/a.txt");
    expect(toolSummary({ description: " \n", command: "ls" })).toBe("ls");
  });

  test("keeps only the first line with text", () => {
    expect(toolSummary({ command: "first\nsecond" })).toBe("first");
    expect(toolSummary({ command: "\nls -la" })).toBe("ls -la");
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
    expect(folderName("/Users/user/reports\\2026")).toBe("reports\\2026");
  });
});
