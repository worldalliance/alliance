import {
  _electron as electron,
  type ElectronApplication,
  type Page,
  test,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CLAUDE_CODE_VERSION } from "../src/main/agent/claude/protocol";
import {
  captureDir,
  type CaptureRecord,
  CaptureRecordKind,
  formatCapture,
} from "../src/main/agent/claude/testing/capture";
import { stubCapturesVariable } from "../src/main/agent/claude/testing/stub";
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { appArgs } from "./app-args";

export const captured = (name: string) =>
  path.join(captureDir(CLAUDE_CODE_VERSION), `${name}.jsonl`);

export function writeTestCapture(params: {
  name: string;
  args: string[];
  records: CaptureRecord[];
}): string {
  const file = test.info().outputPath(`${params.name}.jsonl`);
  writeFileSync(
    file,
    formatCapture([
      { kind: CaptureRecordKind.Start, args: params.args },
      ...params.records,
    ]),
  );
  return file;
}

export const authStatusCapture = (loggedIn: boolean): string =>
  writeTestCapture({
    name: `auth-status-${loggedIn}`,
    args: ["auth", "status", "--json"],
    records: [
      {
        kind: CaptureRecordKind.Out,
        text: JSON.stringify({
          loggedIn,
          authMethod: loggedIn ? "claude.ai" : "none",
        }),
      },
      { kind: CaptureRecordKind.Exit, code: loggedIn ? 0 : 1 },
    ],
  });

export async function launch(params: {
  captures: string[];
  /** Runs in place of the stub that playwright.config.ts names. */
  claude?: string;
  /** The app looks for claude on this PATH in place of running the stub. */
  path?: string;
}): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: appArgs(),
    env: {
      ...process.env,
      [stubCapturesVariable]: [captured("version"), ...params.captures].join(
        path.delimiter,
      ),
      ...(params.claude && { [claudeExecutableVariable]: params.claude }),
      ...(params.path !== undefined && {
        [claudeExecutableVariable]: "",
        PATH: params.path,
      }),
    },
  });
  return { app, page: await app.firstWindow() };
}

export function workFolder(): string {
  const folder = test.info().outputPath("work");
  mkdirSync(folder, { recursive: true });
  return folder;
}

/** Runs the stub under this test's own path, so the test can count the CLIs it started, and exits a second after the stub, as a CLI running its session-end hooks does. */
export function trackedClaude(): string {
  const file = test.info().outputPath("claude");
  writeFileSync(
    file,
    `#!/bin/sh\n"${process.env[claudeExecutableVariable]}" "$@"\nstatus=$?\nsleep 1\nexit $status\n`,
  );
  chmodSync(file, 0o755);
  return file;
}

export const runningCount = (claude: string): number =>
  execFileSync("ps", ["-ax", "-o", "command="], { encoding: "utf8" })
    .split("\n")
    .filter((command) => command.includes(claude)).length;
