import { expect, onTestFinished, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../common/src/result";
import {
  type CliCommand,
  closePipesAfterExit,
  failureOutput,
  runCli,
  spawnSessionCli,
} from "./cli-process";

const bun: CliCommand = {
  executable: process.execPath,
  env: process.env,
  name: "cli",
};

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

test("a failure names the exit code, with stdout when stderr is empty", () => {
  expect(
    failureOutput("claude x", {
      code: 1,
      signal: null,
      stdout: "out",
      stderr: "",
    }),
  ).toEqual(new Error("claude x exited with code 1: out"));
});

test("a failure names the signal that killed the CLI, with stderr over stdout", () => {
  expect(
    failureOutput("claude auth login", {
      code: null,
      signal: "SIGTERM",
      stdout: "out",
      stderr: "bye",
    }),
  ).toEqual(new Error("claude auth login was killed by SIGTERM: bye"));
});

test("a failure keeps the last 2000 characters of the output", () => {
  expect(
    failureOutput("claude x", {
      code: 1,
      signal: null,
      stdout: "",
      stderr: `a${"b".repeat(2000)}`,
    }),
  ).toEqual(new Error(`claude x exited with code 1: ${"b".repeat(2000)}`));
});

test("a session CLI that can't start fails, naming the executable and folder", async () => {
  const spawned = (executable: string, cwd: string) =>
    spawnSessionCli({ executable, args: [], cwd, env: {} });
  const missingCli = await spawned("/nonexistent/cli", process.cwd());
  expect(missingCli.ok || missingCli.error.message).toStartWith(
    `couldn't start /nonexistent/cli in ${process.cwd()}: `,
  );
  const missingCwd = await spawned("sh", "/nonexistent/folder");
  expect(missingCwd.ok || missingCwd.error.message).toStartWith(
    "couldn't start sh in /nonexistent/folder: ",
  );
});

test("returns once the CLI exits while a process it started holds its output open", async () => {
  const result = await runCli(bun, {
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
  const dir = mkdtempSync(path.join(tmpdir(), "cli-process-test-"));
  const pidFile = path.join(dir, "pid");
  const abort = new AbortController();
  try {
    const running = runCli(bun, {
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
  const dir = mkdtempSync(path.join(tmpdir(), "cli-process-test-"));
  const ready = path.join(dir, "ready");
  const exited = path.join(dir, "exited");
  const abort = new AbortController();
  const script = `process.on("SIGTERM", () => setTimeout(() => { require("fs").writeFileSync(${JSON.stringify(exited)}, ""); process.exit(0); }, 200)); require("fs").writeFileSync(${JSON.stringify(ready)}, ""); setInterval(() => {}, 1000);`;
  try {
    const running = runCli(bun, {
      args: ["-e", script],
      signal: abort.signal,
    });
    while (!existsSync(ready)) await Bun.sleep(10);
    abort.abort();
    expect(await running).toEqual(
      R.failure(new Error(`cli -e ${script} was cancelled`)),
    );
    expect(existsSync(exited)).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kills a cancelled CLI that ignores SIGTERM", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cli-process-test-"));
  const ready = path.join(dir, "ready");
  const abort = new AbortController();
  const script = `process.on("SIGTERM", () => {}); require("fs").writeFileSync(${JSON.stringify(ready)}, ""); setInterval(() => {}, 1000);`;
  try {
    const running = runCli(bun, {
      args: ["-e", script],
      signal: abort.signal,
    });
    while (!existsSync(ready)) await Bun.sleep(10);
    abort.abort();
    expect(await running).toEqual(
      R.failure(new Error(`cli -e ${script} was cancelled`)),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 10_000);

test("reports a run its timeout signal aborts as timed out", async () => {
  expect(
    await runCli(bun, {
      args: ["-e", "setTimeout(() => {}, 60_000)"],
      signal: AbortSignal.timeout(100),
    }),
  ).toEqual(
    R.failure(new Error("cli -e setTimeout(() => {}, 60_000) timed out")),
  );
});

test("reports a run aborted right after it starts as cancelled", async () => {
  const abort = new AbortController();
  const running = runCli(bun, {
    args: ["-e", "setTimeout(() => {}, 60_000)"],
    signal: abort.signal,
  });
  abort.abort();
  expect(await running).toEqual(
    R.failure(new Error("cli -e setTimeout(() => {}, 60_000) was cancelled")),
  );
});

test("reports an executable it can't start", async () => {
  const result = await runCli(
    { ...bun, executable: "/nonexistent/cli" },
    { args: [] },
  );
  expect(result.ok ? "" : result.error.message).toStartWith(
    "couldn't run /nonexistent/cli: ",
  );
});

test("reports arguments it can't pass to the CLI", async () => {
  const result = await runCli(bun, { args: ["a\0b"] });
  expect(result.ok ? "" : result.error.message).toStartWith(
    `couldn't run ${process.execPath}: `,
  );
});

test("reports a cancelled run of an executable it can't start as cancelled", async () => {
  expect(
    await runCli(
      { ...bun, executable: "/nonexistent/cli" },
      { args: ["--version"], signal: AbortSignal.abort() },
    ),
  ).toEqual(R.failure(new Error("cli --version was cancelled")));
});
