import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { R } from "../../../../../../../common/src/result";
import { runClaude } from "../process";
import { type CaptureRecord, CaptureRecordKind } from "./capture";
import { replay, stopReplay, stubCli, writeCapture } from "./stub";

afterEach(stopReplay);

test("replays the first capture whose arguments match, with any session id", async () => {
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: ["--other"] },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
    writeCapture([
      { kind: CaptureRecordKind.Start, args: ["--resume", randomUUID()] },
      { kind: CaptureRecordKind.Out, text: "out" },
      { kind: CaptureRecordKind.Stderr, text: "err" },
      { kind: CaptureRecordKind.Exit, code: 3 },
    ]),
    writeCapture([
      { kind: CaptureRecordKind.Start, args: ["--resume", randomUUID()] },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  expect(
    await runClaude(stubCli, { args: ["--resume", randomUUID()] }),
  ).toEqual(
    R.success({ code: 3, signal: null, stdout: "out\n", stderr: "err" }),
  );
});

test("replays large records whole", async () => {
  const big = "x".repeat(3_000_000);
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: [] },
      { kind: CaptureRecordKind.Out, text: big },
      { kind: CaptureRecordKind.Stderr, text: big },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  expect(await runClaude(stubCli, { args: [] })).toEqual(
    R.success({ code: 0, signal: null, stdout: `${big}\n`, stderr: big }),
  );
});

test("fails when no capture matches", async () => {
  replay(writeCapture([{ kind: CaptureRecordKind.Start, args: ["a"] }]));
  const result = R.unwrap(await runClaude(stubCli, { args: ["b"] }));
  expect(result.code).toBe(2);
  expect(result.stderr).toStartWith('stub-claude: no capture for ["b"]');
});

test("fails on a capture with no exit record, as a cut-short recording has", async () => {
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: [] },
      { kind: CaptureRecordKind.Out, text: "partial" },
    ]),
  );
  expect(await runClaude(stubCli, { args: [] })).toEqual(
    R.success({
      code: 2,
      signal: null,
      stdout: "",
      stderr: "stub-claude: the capture has no exit record\n",
    }),
  );
});

test.each<[string, CaptureRecord, string]>([
  [
    "a second start record",
    { kind: CaptureRecordKind.Start, args: [] },
    "a second start record in the capture",
  ],
  [
    "a signal exit",
    { kind: CaptureRecordKind.Exit, code: null },
    "can't replay a signal exit",
  ],
])("fails on %s", async (_, record, message) => {
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: [] },
      record,
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  const result = R.unwrap(await runClaude(stubCli, { args: [] }));
  expect(result.code).toBe(1);
  expect(result.stderr).toContain(`stub-claude: ${message}`);
});

function runWithStdin(
  lines: string[],
  options: { end?: boolean } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(stubCli.executable, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.once("close", (code) => resolve({ code, stdout, stderr }));
    for (const line of lines) child.stdin.write(`${line}\n`);
    if (options.end) child.stdin.end();
  });
}

const stdinCapture = () =>
  writeCapture([
    { kind: CaptureRecordKind.Start, args: [] },
    {
      kind: CaptureRecordKind.In,
      text: '{"type":"user","message":"recorded"}',
    },
    { kind: CaptureRecordKind.Out, text: "reply" },
    { kind: CaptureRecordKind.Exit, code: 0 },
  ]);

test("waits for a stdin line of the recorded type, then goes on, with stdin still open", async () => {
  replay(stdinCapture());
  expect(
    await runWithStdin(['{"type":"user","message":"other"}']),
  ).toMatchObject({
    code: 0,
    stdout: "reply\n",
  });
});

test("fails on a stdin line of another type", async () => {
  replay(stdinCapture());
  expect(await runWithStdin(['{"type":"control_request"}'])).toEqual({
    code: 3,
    stdout: "",
    stderr: "stub-claude: expected user on stdin, got control_request\n",
  });
});

test("fails on a control request of another subtype", async () => {
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: [] },
      {
        kind: CaptureRecordKind.In,
        text: '{"type":"control_request","request":{"subtype":"interrupt"}}',
      },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  expect(
    await runWithStdin([
      '{"type":"control_request","request":{"subtype":"initialize"}}',
    ]),
  ).toEqual({
    code: 3,
    stdout: "",
    stderr:
      "stub-claude: expected control_request/interrupt on stdin, got control_request/initialize\n",
  });
});

test("fails on a stdin line that isn't a stream-json object", async () => {
  replay(stdinCapture());
  expect(await runWithStdin(["null"])).toEqual({
    code: 3,
    stdout: "",
    stderr: 'stub-claude: expected user on stdin, got unreadable line "null"\n',
  });
});

test("flushes its output when stdin closes before a recorded stdin line", async () => {
  const big = "x".repeat(3_000_000);
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: [] },
      { kind: CaptureRecordKind.Out, text: big },
      { kind: CaptureRecordKind.In, text: '{"type":"user"}' },
      { kind: CaptureRecordKind.Out, text: "after" },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  expect(await runWithStdin([], { end: true })).toMatchObject({
    code: 0,
    stdout: `${big}\n`,
  });
});

const closingCapture = () =>
  writeCapture([
    { kind: CaptureRecordKind.Start, args: [] },
    { kind: CaptureRecordKind.In, text: '{"type":"user"}' },
    { kind: CaptureRecordKind.StdinClosed },
    { kind: CaptureRecordKind.Out, text: "bye" },
    { kind: CaptureRecordKind.Exit, code: 0 },
  ]);

test("waits for stdin to close where the recording's did", async () => {
  replay(closingCapture());
  expect(await runWithStdin(['{"type":"user"}'], { end: true })).toMatchObject({
    code: 0,
    stdout: "bye\n",
  });
});

test("fails on a stdin line after the recorded input", async () => {
  replay(closingCapture());
  expect(
    await runWithStdin(['{"type":"user"}', '{"type":"user"}'], { end: true }),
  ).toEqual({
    code: 3,
    stdout: "",
    stderr: "stub-claude: unexpected user on stdin after the recorded input\n",
  });
});
