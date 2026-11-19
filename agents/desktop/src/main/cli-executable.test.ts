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
import { AgentKind } from "../shared/agent-kind";
import { CLAUDE_CODE_VERSION } from "./agent/claude/protocol";
import { CODEX_VERSION } from "./agent/codex/version";
import { executableVariable, findExecutable } from "./cli-executable";

const claudeExecutableVariable = executableVariable(AgentKind.Claude);
const findClaudeExecutable = (params: {
  env: NodeJS.ProcessEnv;
  packaged: boolean;
}) => findExecutable({ ...params, agent: AgentKind.Claude });

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

describe("findExecutable for Claude", () => {
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

describe("findExecutable for Codex", () => {
  test("finds codex on PATH, or the executable its own variable names", () => {
    const root = mkdtempSync(path.join(tmpdir(), "codex-path-"));
    dir = root;
    writeFileSync(path.join(root, "codex"), "");
    chmodSync(path.join(root, "codex"), 0o755);
    expect(
      findExecutable({
        agent: AgentKind.Codex,
        env: { PATH: root, [claudeExecutableVariable]: "/claude" },
        packaged: false,
      }),
    ).toEqual({ ok: true, value: path.join(root, "codex") });
    expect(
      findExecutable({
        agent: AgentKind.Codex,
        env: { [executableVariable(AgentKind.Codex)]: "/stub" },
        packaged: false,
      }),
    ).toEqual({ ok: true, value: "/stub" });
  });

  test("says how to install Codex when PATH has none", () => {
    const found = findExecutable({
      agent: AgentKind.Codex,
      env: { PATH: binDirs().without },
      packaged: false,
    });
    expect(!found.ok && found.error.message).toBe(
      `couldn't find Codex. Install Codex ${CODEX_VERSION} so that codex is on PATH.`,
    );
  });
});
