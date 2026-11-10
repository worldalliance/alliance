import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ClaudeCli } from "../process";
import type { CaptureRecord } from "./capture";

export const stubCapturesVariable = "ALLIANCE_AGENT_CLAUDE_STUB_CAPTURES";

export const stubCli: ClaudeCli = {
  executable: fileURLToPath(new URL("./stub-claude.ts", import.meta.url)),
  configDir: "/nonexistent/claude",
};

/** The stub replays, for each run, the first of these capture files whose arguments match. */
export function replay(...files: string[]): void {
  process.env[stubCapturesVariable] = files.join(path.delimiter);
}

let scratch: string | undefined;

export function stopReplay(): void {
  delete process.env[stubCapturesVariable];
  if (scratch) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
}

export function writeCapture(records: CaptureRecord[]): string {
  scratch ??= mkdtempSync(path.join(tmpdir(), "claude-stub-"));
  const file = path.join(scratch, `${randomUUID()}.jsonl`);
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n"));
  return file;
}
