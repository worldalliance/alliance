import { afterEach, expect, onTestFinished, test } from "bun:test";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CaptureRecord,
  CaptureRecordKind,
  readCapture,
} from "./capture-record";

const recorder = fileURLToPath(new URL("./record-cli.ts", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function scratchDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "record-cli-test-"));
  dirs.push(dir);
  return dir;
}

function fakeCli(dir: string, script: string): string {
  const real = path.join(dir, "cli");
  writeFileSync(real, `#!/bin/sh\n${script}`, { mode: 0o755 });
  return real;
}

function record(params: {
  dir: string;
  real: string;
  input?: string[];
  closeStdin?: boolean;
  terminateOnOutput?: boolean;
}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(recorder, ["--x"], {
      env: {
        ...process.env,
        ALLIANCE_AGENT_RECORD_REAL: params.real,
        ALLIANCE_AGENT_RECORD_DIR: params.dir,
        ALLIANCE_AGENT_RECORD_NAME: "run",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      if (params.terminateOnOutput) child.kill("SIGTERM");
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    for (const line of params.input ?? []) child.stdin.write(`${line}\n`);
    if (params.closeStdin) child.stdin.end();
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const replyingCli = "read line\necho reply\nexit 3\n";
const replied: CaptureRecord[] = [
  { kind: CaptureRecordKind.Start, args: ["--x"] },
  { kind: CaptureRecordKind.In, text: '{"type":"user"}' },
  { kind: CaptureRecordKind.Out, text: "reply" },
  { kind: CaptureRecordKind.Exit, code: 3 },
];

test("records the CLI's traffic and forwards its stdout and exit code", async () => {
  const dir = scratchDir();
  const real = fakeCli(dir, replyingCli);
  expect(await record({ dir, real, input: ['{"type":"user"}'] })).toEqual({
    code: 3,
    stdout: "reply\n",
    stderr: "",
  });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual(replied);
});

test("refuses to overwrite an earlier recording under the same name", async () => {
  const dir = scratchDir();
  const real = fakeCli(dir, replyingCli);
  await record({ dir, real, input: ['{"type":"user"}'] });
  const file = path.join(dir, "run-session.jsonl");
  const first = readFileSync(file, "utf8");
  expect((await record({ dir, real, input: ["{}"] })).code).toBe(1);
  expect(readFileSync(file, "utf8")).toBe(first);
});

test("records the CLI closing stdin and its stderr, and forwards the stderr", async () => {
  const dir = scratchDir();
  const real = fakeCli(dir, "cat > /dev/null\necho warn >&2\nexit 0\n");
  expect(await record({ dir, real, closeStdin: true })).toEqual({
    code: 0,
    stdout: "",
    stderr: "warn\n",
  });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual([
    { kind: CaptureRecordKind.Start, args: ["--x"] },
    { kind: CaptureRecordKind.StdinClosed },
    { kind: CaptureRecordKind.Stderr, text: "warn\n" },
    { kind: CaptureRecordKind.Exit, code: 0 },
  ]);
});

test("ends shortly after the CLI exits while a process it started holds its pipes", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "record-cli-test-"));
  const pidFile = path.join(dir, "sleep.pid");
  // Runs after afterEach, so this test removes its own folder once the pid is read.
  onTestFinished(() => {
    if (existsSync(pidFile))
      process.kill(Number(readFileSync(pidFile, "utf8")));
    rmSync(dir, { recursive: true, force: true });
  });
  const real = fakeCli(
    dir,
    `echo reply\nsleep 30 &\necho $! > ${pidFile}\nsleep 0.5\nexit 3\n`,
  );
  const recorded = await record({ dir, real });
  expect(recorded).toEqual({
    code: 3,
    stdout: "reply\n",
    stderr: "",
  });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual([
    { kind: CaptureRecordKind.Start, args: ["--x"] },
    { kind: CaptureRecordKind.Out, text: "reply" },
    { kind: CaptureRecordKind.Exit, code: 3 },
  ]);
});

test("passes SIGTERM on to the CLI and records its exit", async () => {
  const dir = scratchDir();
  const real = fakeCli(dir, "echo ready\nexec sleep 30\n");
  expect(await record({ dir, real, terminateOnOutput: true })).toEqual({
    code: 1,
    stdout: "ready\n",
    stderr: "",
  });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual([
    { kind: CaptureRecordKind.Start, args: ["--x"] },
    { kind: CaptureRecordKind.Out, text: "ready" },
    { kind: CaptureRecordKind.Exit, code: null },
  ]);
});
