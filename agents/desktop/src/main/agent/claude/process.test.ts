import { expect, onTestFinished, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import {
  type ClaudeCli,
  claudeEnvironment,
  closePipesAfterExit,
  runClaude,
} from "./process";

const bun: ClaudeCli = { executable: process.execPath, configDir: "/config" };

test("the CLI's environment drops its inherited namespaces and other credentials and turns off nonessential traffic", () => {
  const env = claudeEnvironment("/config", {
    PATH: "/bin",
    HOME: "/home/user",
    SSH_AUTH_SOCK: "/agent.sock",
    GH_TOKEN: "g",
    ANTHROPIC_API_KEY: "a",
    ANTHROPIC_AUTH_TOKEN: "b",
    ANTHROPIC_BASE_URL: "http://gateway",
    ANTHROPIC_PROFILE: "work",
    CLAUDE_CODE_OAUTH_TOKEN: "c",
    CLAUDE_CODE_USE_BEDROCK: "1",
    CLAUDE_CODE_API_BASE_URL: "http://gateway",
    CLAUDECODE: "1",
    CLAUDE_CODE_CHILD_SESSION: "1",
    CLAUDE_CODE_MESSAGING_TOKEN: "m",
    CLAUDE_CONFIG_DIR: "/home/user/.claude",
    OPENAI_API_KEY: "d",
  });
  expect(env).toEqual({
    PATH: "/bin",
    HOME: "/home/user",
    SSH_AUTH_SOCK: "/agent.sock",
    GH_TOKEN: "g",
    CLAUDE_CONFIG_DIR: "/config",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    DISABLE_UPDATES: "1",
  });
});

test("closes the pipes of an exited CLI that a process it started still holds", async () => {
  // Under load Bun can miss both the output and the exit of a child that exits at once, so the shell lingers.
  const child = spawn("sh", ["-c", "sleep 30 & echo $!; sleep 0.5"]);
  closePipesAfterExit(child);
  let stdout = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
  onTestFinished(() => {
    if (/^\d+\n$/.test(stdout)) process.kill(Number(stdout));
  });
  await new Promise((resolve) => child.once("close", resolve));
  expect(stdout).toMatch(/^\d+\n$/);
});

test("runs the CLI in that environment and returns its exit and output", async () => {
  const result = await runClaude(bun, {
    args: [
      "-e",
      "console.log(process.env.CLAUDE_CONFIG_DIR); console.error('warn'); process.exit(3)",
    ],
  });
  expect(result).toEqual(
    R.success({ code: 3, signal: null, stdout: "/config\n", stderr: "warn\n" }),
  );
});

test("returns once the CLI exits while a process it started holds its output open", async () => {
  const result = await runClaude(bun, {
    args: [
      "-e",
      `const c = require("child_process").spawn("sleep", ["30"], { stdio: "inherit", detached: true }); c.unref(); console.log(c.pid)`,
    ],
  });
  const stdout = result.ok ? result.value.stdout : "";
  expect(stdout).toMatch(/^\d+\n$/);
  process.kill(Number(stdout));
  expect(result).toEqual(
    R.success({ code: 0, signal: null, stdout, stderr: "" }),
  );
});

test("reports a run aborted after the CLI exited as finished", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-process-test-"));
  const pidFile = path.join(dir, "pid");
  const abort = new AbortController();
  try {
    const running = runClaude(bun, {
      args: [
        "-e",
        `const c = require("child_process").spawn("sleep", ["30"], { stdio: "inherit", detached: true }); c.unref(); require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(c.pid))`,
      ],
      signal: abort.signal,
    });
    while (!existsSync(pidFile)) await Bun.sleep(10);
    await Bun.sleep(300);
    abort.abort();
    process.kill(Number(readFileSync(pidFile, "utf8")));
    expect(await running).toEqual(
      R.success({ code: 0, signal: null, stdout: "", stderr: "" }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports a run its signal aborts as cancelled once the CLI has exited", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-process-test-"));
  const ready = path.join(dir, "ready");
  const exited = path.join(dir, "exited");
  const abort = new AbortController();
  const script = `process.on("SIGTERM", () => setTimeout(() => { require("fs").writeFileSync(${JSON.stringify(exited)}, ""); process.exit(0); }, 200)); require("fs").writeFileSync(${JSON.stringify(ready)}, ""); setInterval(() => {}, 1000);`;
  try {
    const running = runClaude(bun, {
      args: ["-e", script],
      signal: abort.signal,
    });
    while (!existsSync(ready)) await Bun.sleep(10);
    abort.abort();
    expect(await running).toEqual(
      R.failure(new Error(`claude -e ${script} was cancelled`)),
    );
    expect(existsSync(exited)).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kills a cancelled CLI that ignores SIGTERM", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-process-test-"));
  const ready = path.join(dir, "ready");
  const abort = new AbortController();
  const script = `process.on("SIGTERM", () => {}); require("fs").writeFileSync(${JSON.stringify(ready)}, ""); setInterval(() => {}, 1000);`;
  try {
    const running = runClaude(bun, {
      args: ["-e", script],
      signal: abort.signal,
    });
    while (!existsSync(ready)) await Bun.sleep(10);
    abort.abort();
    expect(await running).toEqual(
      R.failure(new Error(`claude -e ${script} was cancelled`)),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 10_000);

test("reports a run its timeout signal aborts as timed out", async () => {
  expect(
    await runClaude(bun, {
      args: ["-e", "setTimeout(() => {}, 60_000)"],
      signal: AbortSignal.timeout(100),
    }),
  ).toEqual(
    R.failure(new Error("claude -e setTimeout(() => {}, 60_000) timed out")),
  );
});

test("reports a run aborted right after it starts as cancelled", async () => {
  const abort = new AbortController();
  const running = runClaude(bun, {
    args: ["-e", "setTimeout(() => {}, 60_000)"],
    signal: abort.signal,
  });
  abort.abort();
  expect(await running).toEqual(
    R.failure(
      new Error("claude -e setTimeout(() => {}, 60_000) was cancelled"),
    ),
  );
});

test("reports an executable it can't start", async () => {
  const result = await runClaude(
    { executable: "/nonexistent/claude", configDir: "/config" },
    { args: [] },
  );
  expect(result.ok ? "" : result.error.message).toStartWith(
    "couldn't run /nonexistent/claude: ",
  );
});

test("reports arguments it can't pass to the CLI", async () => {
  const result = await runClaude(bun, { args: ["a\0b"] });
  expect(result.ok ? "" : result.error.message).toStartWith(
    `couldn't run ${process.execPath}: `,
  );
});

test("reports a cancelled run of an executable it can't start as cancelled", async () => {
  expect(
    await runClaude(
      { executable: "/nonexistent/claude", configDir: "/config" },
      { args: ["--version"], signal: AbortSignal.abort() },
    ),
  ).toEqual(R.failure(new Error("claude --version was cancelled")));
});
