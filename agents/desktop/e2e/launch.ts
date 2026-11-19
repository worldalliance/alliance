import {
  _electron as electron,
  type ElectronApplication,
  type Page,
  test,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
import { executableVariable } from "../src/main/cli-executable";
import { AgentKind } from "../src/shared/agent-kind";
import { appArgs } from "./app-args";

export { captured };

export const claudeExecutableVariable = executableVariable(AgentKind.Claude);

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
  params: { captures: string[]; env?: Record<string, string> } & (
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
    ...params.env,
  };
  if (params.path !== undefined) delete env[claudeExecutableVariable];
  const app = await electron.launch({ args: appArgs(), env });
  return { app, page: await app.firstWindow() };
}

export function workFolder(): string {
  const folder = test.info().outputPath("work");
  mkdirSync(folder, { recursive: true });
  return folder;
}

/** Writes script as this test's claude, an sh script. */
export function writeClaude(script: string): string {
  const claude = test.info().outputPath("claude");
  writeFileSync(claude, `#!/bin/sh\n${script}`);
  chmodSync(claude, 0o755);
  return claude;
}

/** A CLI that answers the version and sign-in checks through the stub and runs script as a session. */
export const sessionClaude = (script: string): string =>
  writeClaude(`case "$1" in
  --version|auth) exec "${process.env[claudeExecutableVariable]}" "$@";;
esac
${script}`);

/** Exits as a session starts, before reading any message. */
export const unreadingClaude = (): string => sessionClaude("exit 1");

/** Runs the stub under this test's own path, so the test can count the CLIs it started, and exits a second after the stub, even one stopped by SIGTERM, as a CLI running its session-end hooks does. On exit it notes for outlivedApp whether the app had already gone. */
export function trackedClaude(): string {
  return writeClaude(`trap 'term=1; [ -z "$pid" ] || kill -TERM "$pid" 2>/dev/null' TERM
# sh gives a background child /dev/null as stdin, so the stub reads this script's stdin from fd 3.
exec 3<&0
status=143
if [ -z "$term" ]; then
  # sh runs a trap only once its foreground child exits, so the stub runs in the background.
  "${process.env[claudeExecutableVariable]}" "$@" <&3 3<&- &
  pid=$!
  # A SIGTERM that reaches the stub before it execs is lost; the stub still stops at the end of its stdin, which the app closes or never opens before any SIGTERM.
  [ -z "$term" ] || kill -TERM "$pid" 2>/dev/null
  wait "$pid"; status=$?
  while kill -0 "$pid" 2>/dev/null; do wait "$pid"; status=$?; done
  # The system can reuse a reaped pid, so a later SIGTERM leaves it alone.
  pid=
fi
sleep 1
${noteOutlivedApp}
exit $status
`);
}

/** Shell for a wrapper's last step that notes when the CLI outlived the app that started it. */
export const noteOutlivedApp =
  'kill -0 $PPID 2>/dev/null || touch "$0.outlived-app"';

export const outlivedApp = (claude: string): boolean =>
  existsSync(`${claude}.outlived-app`);

/** Every process's columns, as `ps -o` names them, one line each. */
export const processLines = (columns: string): string[] =>
  execFileSync("ps", ["-A", "-ww", "-o", columns], {
    encoding: "utf8",
    // A busy machine's full process list can outgrow execFileSync's 1 MB default buffer.
    maxBuffer: 256 * 1024 * 1024,
  }).split("\n");

export const runningCount = (claude: string): number =>
  processLines("command=").filter((command) => command.includes(claude)).length;
