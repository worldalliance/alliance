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
import { type CaptureRecord, CaptureRecordKind, readCapture } from "./capture";
import {
  stopReplay,
  stubCapturesVariable,
  stubCli,
  writeCapture,
} from "./stub";

const recorder = fileURLToPath(new URL("./record-claude.ts", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  stopReplay();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

const capture: CaptureRecord[] = [
  { kind: CaptureRecordKind.Start, args: ["--x"] },
  { kind: CaptureRecordKind.In, text: '{"type":"user"}' },
  { kind: CaptureRecordKind.Out, text: "reply" },
  { kind: CaptureRecordKind.Exit, code: 3 },
];

function record(
  dir: string,
  {
    replayed = capture,
    real = stubCli.executable,
    terminateOnOutput = false,
  } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(recorder, ["--x"], {
      env: {
        ...process.env,
        ALLIANCE_AGENT_CLAUDE_REAL: real,
        ALLIANCE_AGENT_CLAUDE_RECORD_DIR: dir,
        ALLIANCE_AGENT_CLAUDE_RECORD_NAME: "run",
        [stubCapturesVariable]: writeCapture(replayed),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      if (terminateOnOutput) child.kill("SIGTERM");
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    for (const record of replayed)
      if (record.kind === CaptureRecordKind.In)
        child.stdin.write(`${record.text}\n`);
    if (
      replayed.some((record) => record.kind === CaptureRecordKind.StdinClosed)
    )
      child.stdin.end();
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("records the CLI's traffic and forwards its stdout and exit code", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-record-test-"));
  dirs.push(dir);
  expect(await record(dir)).toEqual({
    code: 3,
    stdout: "reply\n",
    stderr: "",
  });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual(capture);
});

test("refuses to overwrite an earlier recording under the same name", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-record-test-"));
  dirs.push(dir);
  await record(dir);
  const file = path.join(dir, "run-session.jsonl");
  const first = readFileSync(file, "utf8");
  expect((await record(dir)).code).toBe(1);
  expect(readFileSync(file, "utf8")).toBe(first);
});

test("records the CLI closing stdin and its stderr, and forwards the stderr", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-record-test-"));
  dirs.push(dir);
  const closing: CaptureRecord[] = [
    { kind: CaptureRecordKind.Start, args: ["--x"] },
    { kind: CaptureRecordKind.StdinClosed },
    { kind: CaptureRecordKind.Stderr, text: "warn\n" },
    { kind: CaptureRecordKind.Exit, code: 0 },
  ];
  expect(await record(dir, { replayed: closing })).toEqual({
    code: 0,
    stdout: "",
    stderr: "warn\n",
  });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual(closing);
});

test("ends shortly after the CLI exits while a process it started holds its pipes", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-record-test-"));
  const real = path.join(dir, "claude");
  const pidFile = path.join(dir, "sleep.pid");
  // Runs after afterEach, so this test removes its own folder once the pid is read.
  onTestFinished(() => {
    if (existsSync(pidFile))
      process.kill(Number(readFileSync(pidFile, "utf8")));
    rmSync(dir, { recursive: true, force: true });
  });
  writeFileSync(
    real,
    `#!/bin/sh\necho reply\nsleep 30 &\necho $! > ${pidFile}\nsleep 0.5\nexit 3\n`,
    { mode: 0o755 },
  );
  const recorded = await record(dir, { replayed: [], real });
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
  const dir = mkdtempSync(path.join(tmpdir(), "claude-record-test-"));
  dirs.push(dir);
  const real = path.join(dir, "claude");
  writeFileSync(real, "#!/bin/sh\necho ready\nexec sleep 30\n", {
    mode: 0o755,
  });
  expect(
    await record(dir, { replayed: [], real, terminateOnOutput: true }),
  ).toEqual({ code: 1, stdout: "ready\n", stderr: "" });
  expect(readCapture(path.join(dir, "run-session.jsonl"))).toEqual([
    { kind: CaptureRecordKind.Start, args: ["--x"] },
    { kind: CaptureRecordKind.Out, text: "ready" },
    { kind: CaptureRecordKind.Exit, code: null },
  ]);
});
