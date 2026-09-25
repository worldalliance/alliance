import {
  lineRanges,
  parseAddedLines,
  parseLcov,
  testFailures,
} from "./coverage";

test("collects added lines per file and skips deleted files", () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -3 +3 @@ export const a = 1;",
    "@@ -10,2 +11,3 @@",
    "@@ -20,4 +22,0 @@",
    "diff --git a/src/gone.ts b/src/gone.ts",
    "--- a/src/gone.ts",
    "+++ /dev/null",
    "@@ -1,5 +0,0 @@",
    "diff --git a/src/new.ts b/src/new.ts",
    "--- /dev/null",
    "+++ b/src/new.ts",
    "@@ -0,0 +1,2 @@",
  ].join("\n");
  expect(parseAddedLines(diff)).toEqual(
    new Map([
      ["src/a.ts", new Set([3, 11, 12, 13])],
      ["src/new.ts", new Set([1, 2])],
    ]),
  );
});

test("reads an added line starting with ++ as content", () => {
  const diff = [
    "diff --git a/a.ts b/a.ts",
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -1,0 +2 @@",
    "+++ counter;",
    "@@ -5,0 +7,2 @@",
  ].join("\n");
  expect(parseAddedLines(diff)).toEqual(
    new Map([["a.ts", new Set([2, 7, 8])]]),
  );
});

test("reads a removed -- line and an added ++ line as content", () => {
  const diff = [
    "diff --git a/q.ts b/q.ts",
    "--- a/q.ts",
    "+++ b/q.ts",
    "@@ -2 +2 @@",
    "--- drop the old row",
    "+++ counter;",
    "@@ -9,0 +10,2 @@",
  ].join("\n");
  expect(parseAddedLines(diff)).toEqual(
    new Map([["q.ts", new Set([2, 10, 11])]]),
  );
});

test("drops the tab git ends a header with when the path has a space", () => {
  const diff = [
    "diff --git a/a b.ts b/a b.ts",
    "--- a/a b.ts\t",
    "+++ b/a b.ts\t",
    "@@ -1,0 +2 @@",
  ].join("\n");
  expect(parseAddedLines(diff)).toEqual(new Map([["a b.ts", new Set([2])]]));
});

test("throws on a path git quotes", () => {
  const diff = [
    'diff --git "a/q\\"x.ts" "b/q\\"x.ts"',
    '--- "a/q\\"x.ts"',
    '+++ "b/q\\"x.ts"',
  ].join("\n");
  expect(() => parseAddedLines(diff)).toThrow('"b/q\\"x.ts"');
});

test("names failed tests and errors from a failed run", () => {
  const output = [
    "error: expect(received).toBe(expected)",
    "(fail) used [0.1ms]",
    "# Unhandled error between tests",
    "error: Cannot find module './missing'",
    " 1 pass",
  ].join("\n");
  expect(testFailures({ output, status: 1 })).toEqual([
    "error: expect(received).toBe(expected)",
    "(fail) used [0.1ms]",
    "error: Cannot find module './missing'",
  ]);
});

test("falls back to the exit code when a failed run names nothing", () => {
  expect(testFailures({ output: " 1 pass", status: 3 })).toEqual([
    "bun test exited 3",
  ]);
});

test("reports no failures for a passing run", () => {
  expect(
    testFailures({ output: "error: logged by a test", status: 0 }),
  ).toEqual([]);
});

test("reads line hits per source file", () => {
  const lcov = [
    "TN:",
    "SF:src/a.ts",
    "FNF:1",
    "DA:1,4",
    "DA:2,0",
    "end_of_record",
    "SF:../common/src/b.ts",
    "DA:5,1",
    "end_of_record",
  ].join("\n");
  expect(parseLcov(lcov)).toEqual(
    new Map([
      [
        "src/a.ts",
        new Map([
          [1, 4],
          [2, 0],
        ]),
      ],
      ["../common/src/b.ts", new Map([[5, 1]])],
    ]),
  );
});

test("collapses consecutive lines into ranges", () => {
  expect(lineRanges([7, 1, 3, 2, 9, 10])).toBe("1-3, 7, 9-10");
  expect(lineRanges([])).toBe("");
});
