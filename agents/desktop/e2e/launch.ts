import {
  _electron as electron,
  type ElectronApplication,
  type Page,
  test,
} from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  authStatusArgs,
  authStatusReply,
  captured,
  type CaptureRecord,
  CaptureRecordKind,
  formatCapture,
} from "../src/main/agent/claude/testing/capture";
import { stubCapturesVariable } from "../src/main/agent/claude/testing/stub";
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { appArgs } from "./app-args";

export { captured };

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
    args: authStatusArgs,
    records: authStatusReply(loggedIn),
  });

export async function launch(
  params: { captures: string[] } & (
    | {
        /** Runs in place of the stub that playwright.config.ts names. */
        claude?: string;
        path?: never;
      }
    | {
        /** The app looks for claude on this PATH in place of running the stub. */
        path: string;
        claude?: never;
      }
  ),
): Promise<{ app: ElectronApplication; page: Page }> {
  const env = {
    ...process.env,
    [stubCapturesVariable]: [captured("version"), ...params.captures].join(
      path.delimiter,
    ),
    ...(params.claude && { [claudeExecutableVariable]: params.claude }),
    ...(params.path !== undefined && { PATH: params.path }),
  };
  if (params.path !== undefined) delete env[claudeExecutableVariable];
  const app = await electron.launch({ args: appArgs(), env });
  return { app, page: await app.firstWindow() };
}
