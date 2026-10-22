import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function check(params: { check: string; dirty: string | null }): number {
  const dir = mkdtempSync(join(tmpdir(), "dirty-check-"));
  try {
    if (params.dirty !== null)
      writeFileSync(join(dir, "dirty.txt"), params.dirty);
    return Bun.spawnSync([`${import.meta.dir}/check.sh`], {
      cwd: dir,
      env: { ...process.env, CHECK: params.check },
    }).exitCode;
  } finally {
    rmSync(dir, { recursive: true });
  }
}

describe("dirty-check", () => {
  test("exists fails only when dirty.txt is missing", () => {
    expect(check({ check: "exists", dirty: null })).toBe(1);
    expect(check({ check: "exists", dirty: "" })).toBe(0);
    expect(check({ check: "exists", dirty: "freeze\n" })).toBe(0);
  });

  test("empty fails only when dirty.txt has content", () => {
    expect(check({ check: "empty", dirty: null })).toBe(0);
    expect(check({ check: "empty", dirty: "" })).toBe(0);
    expect(check({ check: "empty", dirty: "freeze\n" })).toBe(1);
  });

  test("an unknown check fails", () => {
    expect(check({ check: "bogus", dirty: "" })).toBe(1);
  });
});
