import path from "node:path";
import { createInterface } from "node:readline";
import { CaptureRecordKind, readCapture } from "./capture-record";

/** Replays, as the running process, the first capture in capturesVariable's files whose arguments match this process's: its output as recorded, waiting at each recorded stdin line for one of the same shape and failing on stdin the recording didn't have. */
export async function replayCapture(params: {
  /** Prefixes the stub's own errors, such as "stub-claude". */
  name: string;
  capturesVariable: string;
  /** What a stdin line must match, such as its message type. */
  shape: (line: string) => string;
  /** Compares arguments, so values that differ between runs, such as session ids, can match. */
  normalizeArgs: (args: readonly string[]) => string;
}): Promise<void> {
  const { name, shape, normalizeArgs } = params;
  const files = (process.env[params.capturesVariable] ?? "")
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
      `${name}: no capture for ${args} in ${files.join(", ")}\n`,
    );
    process.exit(2);
  }
  if (capture.at(-1)?.kind !== CaptureRecordKind.Exit) {
    process.stderr.write(`${name}: the capture has no exit record\n`);
    process.exit(2);
  }

  const lines = createInterface({ input: process.stdin });
  const stdin = lines[Symbol.asyncIterator]();

  replay: for (const entry of capture.slice(1)) {
    switch (entry.kind) {
      case CaptureRecordKind.Start:
        throw new Error(`${name}: a second start record in the capture`);
      case CaptureRecordKind.Out:
        process.stdout.write(`${entry.text}\n`);
        break;
      case CaptureRecordKind.Stderr:
        process.stderr.write(entry.text);
        break;
      case CaptureRecordKind.In: {
        const next = await stdin.next();
        if (next.done) break replay;
        if (shape(next.value) !== shape(entry.text)) {
          process.stderr.write(
            `${name}: expected ${shape(entry.text)} on stdin, got ${shape(next.value)}\n`,
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
            `${name}: unexpected ${shape(next.value)} on stdin after the recorded input\n`,
          );
          process.exitCode = 3;
          break replay;
        }
        break;
      }
      case CaptureRecordKind.Exit:
        if (entry.code === null)
          throw new Error(`${name}: can't replay a signal exit`);
        // process.exit would drop a large record still in the pipe; the stub exits once stdout and stderr flush and lines.close() below stops reading stdin.
        process.exitCode = entry.code;
        break;
      default:
        throw new Error(`unknown record: ${entry satisfies never}`);
    }
  }
  lines.close();
}
