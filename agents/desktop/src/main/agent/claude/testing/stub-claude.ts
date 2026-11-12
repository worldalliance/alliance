#!/usr/bin/env bun
// Stands in for the claude executable in tests: replays the capture whose arguments match its own.
import path from "node:path";
import { createInterface } from "node:readline";
import { CaptureRecordKind, readCapture, stdinShape } from "./capture";
import { stubCapturesVariable } from "./stub";

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
// Session ids differ between the recorded run and a replay, so they compare as equal.
const normalizeArgs = (args: readonly string[]): string =>
  JSON.stringify(args.map((arg) => arg.replace(uuid, "<uuid>")));

const files = (process.env[stubCapturesVariable] ?? "")
  .split(path.delimiter)
  .filter(Boolean);
const args = normalizeArgs(process.argv.slice(2));
const capture = files
  .map(readCapture)
  .find(
    ([start]) =>
      start?.kind === CaptureRecordKind.Start &&
      normalizeArgs(start.args) === args,
  );
if (!capture) {
  process.stderr.write(
    `stub-claude: no capture for ${args} in ${files.join(", ")}\n`,
  );
  process.exit(2);
}
if (capture.at(-1)?.kind !== CaptureRecordKind.Exit) {
  process.stderr.write("stub-claude: the capture has no exit record\n");
  process.exit(2);
}

const lines = createInterface({ input: process.stdin });
const stdin = lines[Symbol.asyncIterator]();

replay: for (const entry of capture.slice(1)) {
  switch (entry.kind) {
    case CaptureRecordKind.Start:
      throw new Error("stub-claude: a second start record in the capture");
    case CaptureRecordKind.Out:
      process.stdout.write(`${entry.text}\n`);
      break;
    case CaptureRecordKind.Stderr:
      process.stderr.write(entry.text);
      break;
    case CaptureRecordKind.In: {
      const next = await stdin.next();
      if (next.done) break replay;
      if (stdinShape(next.value) !== stdinShape(entry.text)) {
        process.stderr.write(
          `stub-claude: expected ${stdinShape(entry.text)} on stdin, got ${stdinShape(next.value)}\n`,
        );
        process.exitCode = 3;
        break replay;
      }
      break;
    }
    case CaptureRecordKind.StdinClosed: {
      const next = await stdin.next();
      if (!next.done) {
        process.stderr.write(
          `stub-claude: unexpected ${stdinShape(next.value)} on stdin after the recorded input\n`,
        );
        process.exitCode = 3;
        break replay;
      }
      break;
    }
    case CaptureRecordKind.Exit:
      if (entry.code === null)
        throw new Error("stub-claude: can't replay a signal exit");
      // process.exit would drop a large record still in the pipe; the stub exits once stdout and stderr flush and lines.close() below stops reading stdin.
      process.exitCode = entry.code;
      break;
    default:
      throw new Error(`unknown record: ${entry satisfies never}`);
  }
}
lines.close();
