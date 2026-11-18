import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type CaptureRecord, formatCapture } from "./capture-record";

export function stubReplay(params: {
  variable: string;
  scratchPrefix: string;
}) {
  let scratch: string | undefined;
  const writeScratch = (name: string, text: string, mode?: number) => {
    scratch ??= mkdtempSync(path.join(tmpdir(), params.scratchPrefix));
    const file = path.join(scratch, name);
    writeFileSync(file, text, { mode });
    return file;
  };
  return {
    /** The stub replays, for each run, the first of these capture files whose arguments match. */
    replay(...files: string[]): void {
      process.env[params.variable] = files.join(path.delimiter);
    },
    stopReplay(): void {
      delete process.env[params.variable];
      if (scratch) rmSync(scratch, { recursive: true, force: true });
      scratch = undefined;
    },
    writeScratch,
    writeCapture: (records: CaptureRecord[]) =>
      writeScratch(`${randomUUID()}.jsonl`, formatCapture(records)),
  };
}
