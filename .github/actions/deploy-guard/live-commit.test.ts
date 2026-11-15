import { afterEach, beforeEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { COMMIT, NEWER, makeFakeGhDir, runScript } from "./fake-gh";

let dir: string;

beforeEach(() => {
  dir = makeFakeGhDir();
});

afterEach(() => rmSync(dir, { recursive: true }));

const live = (env: Record<string, string>) =>
  runScript({ dir, command: ["live-commit.sh", "production"], env });

test("prints the newest successful production-live deployment's commit", () => {
  const result = live({
    FAKE_DEPLOYMENTS: `11 ${COMMIT}\n10 ${NEWER}\n9 ${COMMIT}\n`,
    FAKE_STATES: "11 failure\n10 success\n9 success",
  });
  expect(result.stdout).toBe(`${NEWER}\n`);
  expect(result.calls).toContain(
    "repos/o/r/deployments?environment=production-live&per_page=100",
  );
  expect(result.calls).not.toContain("deployments/9/statuses");
});

test("prints nothing when no deployment succeeded", () => {
  const result = live({
    FAKE_DEPLOYMENTS: `9 ${COMMIT}\n`,
    FAKE_STATES: "9 in_progress",
  });
  expect([result.code, result.stdout]).toEqual([0, ""]);
});

test("prints nothing when the environment has no deployments", () => {
  const result = live({});
  expect([result.code, result.stdout]).toEqual([0, ""]);
  expect(result.calls).not.toContain("/statuses");
});

test("fails when a status lookup fails", () => {
  const result = live({
    FAKE_DEPLOYMENTS: `9 ${COMMIT}\n`,
    FAKE_FAIL: "deployments/9/statuses",
  });
  expect(result.code).not.toBe(0);
});

test("fails when the deployments lookup fails", () => {
  const result = live({ FAKE_FAIL: "/deployments?" });
  expect(result.code).not.toBe(0);
});
