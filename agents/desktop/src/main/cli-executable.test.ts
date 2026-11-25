import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AgentKind } from "../shared/agent-kind";
import { executableVariable, findExecutable } from "./cli-executable";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

const place = (file: string, mode = 0o755) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), "", { mode });
};

const find = (params: {
  agent: AgentKind;
  packaged: boolean;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: string;
}) =>
  findExecutable({
    env: {},
    root,
    platform: "darwin",
    arch: "arm64",
    ...params,
  });

const claudeInNodeModules =
  "node_modules/@anthropic-ai/claude-code-darwin-arm64/claude";
const codexInNodeModules =
  "node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex";

describe("findExecutable", () => {
  test("a development build runs each CLI from its platform's package in node_modules", () => {
    root = mkdtempSync(path.join(tmpdir(), "cli-executable-"));
    place(claudeInNodeModules);
    place(codexInNodeModules);
    expect(find({ agent: AgentKind.Claude, packaged: false })).toEqual({
      ok: true,
      value: path.join(root, claudeInNodeModules),
    });
    expect(find({ agent: AgentKind.Codex, packaged: false })).toEqual({
      ok: true,
      value: path.join(root, codexInNodeModules),
    });
  });

  test("a packaged app runs each CLI from its resources, ignoring the variables", () => {
    root = mkdtempSync(path.join(tmpdir(), "cli-executable-"));
    place("cli/claude-code/claude");
    place("cli/codex/x86_64-unknown-linux-musl/bin/codex");
    const env = {
      [executableVariable(AgentKind.Claude)]: "/stub",
      [executableVariable(AgentKind.Codex)]: "/stub",
    };
    const linux = {
      packaged: true,
      env,
      platform: "linux",
      arch: "x64",
    } as const;
    expect(find({ ...linux, agent: AgentKind.Claude })).toEqual({
      ok: true,
      value: path.join(root, "cli/claude-code/claude"),
    });
    expect(find({ ...linux, agent: AgentKind.Codex })).toEqual({
      ok: true,
      value: path.join(root, "cli/codex/x86_64-unknown-linux-musl/bin/codex"),
    });
  });

  test("a development build prefers the executable the agent's own variable names, resolved against the working directory", () => {
    root = mkdtempSync(path.join(tmpdir(), "cli-executable-"));
    place(claudeInNodeModules);
    place("stub");
    const named = path.relative(process.cwd(), path.join(root, "stub"));
    expect(
      find({
        agent: AgentKind.Claude,
        packaged: false,
        env: { [executableVariable(AgentKind.Claude)]: named },
      }),
    ).toEqual({ ok: true, value: path.join(root, "stub") });
    expect(
      find({
        agent: AgentKind.Claude,
        packaged: false,
        env: { [executableVariable(AgentKind.Codex)]: named },
      }),
    ).toEqual({ ok: true, value: path.join(root, claudeInNodeModules) });
  });

  test("a variable naming no executable file fails, naming both", () => {
    root = mkdtempSync(path.join(tmpdir(), "cli-executable-"));
    place("plain", 0o644);
    const found = find({
      agent: AgentKind.Codex,
      packaged: false,
      env: { [executableVariable(AgentKind.Codex)]: path.join(root, "plain") },
    });
    expect(!found.ok && found.error.message).toBe(
      `couldn't find Codex at ${path.join(root, "plain")}, which ALLIANCE_AGENT_CODEX_EXECUTABLE names.`,
    );
  });

  test("a missing bundled CLI fails, saying how to install it in a development build and what's missing when packaged", () => {
    root = mkdtempSync(path.join(tmpdir(), "cli-executable-"));
    const dev = find({ agent: AgentKind.Claude, packaged: false });
    expect(!dev.ok && dev.error.message).toBe(
      `couldn't find the Claude Code Alliance agent bundles at ${path.join(root, claudeInNodeModules)}. Run bun install in ${root}.`,
    );
    const packaged = find({ agent: AgentKind.Codex, packaged: true });
    expect(!packaged.ok && packaged.error.message).toBe(
      `this build of Alliance agent doesn't include Codex for darwin-arm64: ${path.join(root, "cli/codex/aarch64-apple-darwin/bin/codex")} is missing or not executable.`,
    );
  });

  test("a platform the app doesn't run the CLIs on fails, naming it", () => {
    root = mkdtempSync(path.join(tmpdir(), "cli-executable-"));
    const found = find({
      agent: AgentKind.Claude,
      packaged: false,
      platform: "win32",
      arch: "x64",
    });
    expect(!found.ok && found.error.message).toBe(
      "Alliance agent doesn't include Claude Code for win32-x64.",
    );
  });
});
