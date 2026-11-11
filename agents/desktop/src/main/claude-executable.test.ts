import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLAUDE_CODE_VERSION } from "./agent/claude/protocol";
import {
  claudeExecutableVariable,
  findClaudeExecutable,
} from "./claude-executable";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function binDirs(): {
  withClaude: string;
  without: string;
  notExecutable: string;
  directory: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "claude-path-"));
  dir = root;
  const make = (name: string, mode?: number) => {
    const bin = path.join(root, name);
    mkdirSync(bin);
    if (mode !== undefined) {
      writeFileSync(path.join(bin, "claude"), "");
      chmodSync(path.join(bin, "claude"), mode);
    }
    return bin;
  };
  return {
    withClaude: make("with", 0o755),
    without: make("without"),
    notExecutable: make("plain", 0o644),
    directory: (() => {
      const bin = make("dir");
      mkdirSync(path.join(bin, "claude"));
      return bin;
    })(),
  };
}

describe("findClaudeExecutable", () => {
  test("finds the first executable claude on PATH", () => {
    const bins = binDirs();
    const PATH = [
      bins.without,
      bins.notExecutable,
      bins.directory,
      bins.withClaude,
    ].join(path.delimiter);
    expect(findClaudeExecutable({ env: { PATH }, packaged: false })).toEqual({
      ok: true,
      value: path.join(bins.withClaude, "claude"),
    });
  });

  test("prefers the executable the variable names", () => {
    expect(
      findClaudeExecutable({
        env: { PATH: "/usr/bin", [claudeExecutableVariable]: "/stub" },
        packaged: false,
      }),
    ).toEqual({ ok: true, value: "/stub" });
  });

  test("resolves a relative variable against the working directory", () => {
    expect(
      findClaudeExecutable({
        env: { [claudeExecutableVariable]: "stub" },
        packaged: false,
      }),
    ).toEqual({ ok: true, value: path.resolve("stub") });
  });

  test("says how to install Claude Code when PATH has none", () => {
    const found = findClaudeExecutable({
      env: { PATH: binDirs().without },
      packaged: false,
    });
    expect(!found.ok && found.error.message).toContain(
      `couldn't find Claude Code. Install Claude Code ${CLAUDE_CODE_VERSION} so`,
    );
  });

  test("a packaged app ignores PATH and the variable", () => {
    const found = findClaudeExecutable({
      env: { PATH: binDirs().withClaude, [claudeExecutableVariable]: "/stub" },
      packaged: true,
    });
    expect(found.ok).toBe(false);
  });
});
