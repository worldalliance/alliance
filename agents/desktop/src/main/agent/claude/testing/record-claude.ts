#!/usr/bin/env bun
// Stands in for the claude executable during a capture run: runs the real CLI and records its traffic.
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { closePipesAfterExit } from "../process";
import { type CaptureRecord, CaptureRecordKind } from "./capture";

const real = process.env.ALLIANCE_AGENT_CLAUDE_REAL;
const dir = process.env.ALLIANCE_AGENT_CLAUDE_RECORD_DIR;
const name = process.env.ALLIANCE_AGENT_CLAUDE_RECORD_NAME;
if (!real || !dir || !name)
  throw new Error(
    "ALLIANCE_AGENT_CLAUDE_REAL, ALLIANCE_AGENT_CLAUDE_RECORD_DIR and ALLIANCE_AGENT_CLAUDE_RECORD_NAME must be set",
  );

const args = process.argv.slice(2);
const file = path.join(
  dir,
  `${name}-${args.includes("--version") ? "version" : "session"}.jsonl`,
);
const record = (entry: CaptureRecord) =>
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
// A second process under the same name fails here rather than overwriting the first one's recording.
writeFileSync(file, "", { flag: "wx" });
record({ kind: CaptureRecordKind.Start, args });

const child = spawn(real, args, { stdio: "pipe" });
closePipesAfterExit(child);
const stdinLines = createInterface({ input: process.stdin })
  .on("line", (text) => {
    record({ kind: CaptureRecordKind.In, text });
    child.stdin.write(`${text}\n`);
  })
  .on("close", () => {
    record({ kind: CaptureRecordKind.StdinClosed });
    child.stdin.end();
  });
createInterface({ input: child.stdout }).on("line", (text) => {
  record({ kind: CaptureRecordKind.Out, text });
  process.stdout.write(`${text}\n`);
});
child.stderr.setEncoding("utf8").on("data", (text: string) => {
  record({ kind: CaptureRecordKind.Stderr, text });
  process.stderr.write(text);
});
child.on("close", (code) => {
  record({ kind: CaptureRecordKind.Exit, code });
  // process.exit would drop forwarded output the backend hasn't read yet; closing stdin lets the recorder exit once it flushes.
  process.exitCode = code ?? 1;
  stdinLines.removeAllListeners("close").close();
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
