import {
  _electron as electron,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
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
import { codexConfigArgs } from "../src/main/agent/codex/process";
import { captured as codexCaptured } from "../src/main/agent/codex/testing/capture";
import { stubCapturesVariable as codexCapturesVariable } from "../src/main/agent/codex/testing/stub";
import { executableVariable } from "../src/main/cli-executable";
import {
  type RepositorySource,
  testSource,
  testSourceVariable,
} from "../src/main/repository/source";
import { git, makeSource } from "../src/main/repository/testing/fixture";
import { commitWorktreeScripts } from "../src/main/worktrees/testing/fixture";
import { AgentKind } from "../src/shared/agent-kind";
import type { AgentApi } from "../src/shared/ipc";
import { RepositoryStatus } from "../src/shared/repository";
import { appArgs } from "./app-args";

declare const window: { agent: AgentApi };

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

/** What `codex login status` writes, exiting 1 when signed out. */
export const codexLoginStatusCapture = (signedIn: boolean): string =>
  writeTestCapture({
    name: `codex-login-status-${signedIn}`,
    args: [...codexConfigArgs, "login", "status"],
    records: [
      { kind: CaptureRecordKind.StdinClosed },
      {
        kind: CaptureRecordKind.Stderr,
        text: signedIn ? "Logged in using ChatGPT\n" : "Not logged in\n",
      },
      { kind: CaptureRecordKind.Exit, code: signedIn ? 0 : 1 },
    ],
  });

export async function launch(params: {
  captures: string[];
  /** Codex's captures, after its version check's. */
  codexCaptures?: string[];
  env?: Record<string, string>;
  /** Runs in place of the stub that playwright.config.ts names. */
  claude?: string;
}): Promise<{ app: ElectronApplication; page: Page }> {
  const ownRepository = !params.env?.[testSourceVariable];
  const env = {
    ...process.env,
    [stubCapturesVariable]: [captured("version"), ...params.captures].join(
      path.delimiter,
    ),
    [codexCapturesVariable]: [
      codexCaptured("version"),
      ...(params.codexCaptures ?? []),
    ].join(path.delimiter),
    ...(params.claude && { [claudeExecutableVariable]: params.claude }),
    ...(ownRepository && {
      [testSourceVariable]: JSON.stringify(testRepository()),
    }),
    ...params.env,
  };
  const app = await electron.launch({ args: appArgs(), env });
  const page = await app.firstWindow();
  // The first launch clones into workFolder by replacing it, which would pull it from under a conversation a test starts there at once.
  if (ownRepository)
    await expect
      .poll(() =>
        page.evaluate(
          async (busy) => {
            const state = await window.agent.repositoryState();
            return state.ok && !busy.includes(state.value.status);
          },
          [RepositoryStatus.Checking, RepositoryStatus.Cloning],
        ),
      )
      .toBe(true);
  return { app, page };
}

/** This test's stand-in for the Alliance repository, with fake worktree scripts and, from the first call, files by relative path, which the app clones into workFolder at its first launch, so conversations without a worktree run there. */
export function testRepository(
  files: Record<string, string> = {},
): RepositorySource {
  const saved = test.info().outputPath("source.json");
  if (existsSync(saved))
    return testSource.parse(JSON.parse(readFileSync(saved, "utf8")));
  const source = makeSource({
    folder: test.info().outputPath("source"),
    defaultFolder: test.info().outputPath("work"),
  });
  commitWorktreeScripts(source.url);
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(source.url, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
    git(source.url, "add", file);
  }
  if (Object.keys(files).length > 0)
    git(source.url, "commit", "-q", "-m", "Test files");
  writeFileSync(saved, JSON.stringify(source));
  return source;
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

/** A CLI that boots slowly, noting when it is stopped before it has read its first message and when it outlives the app. */
export function slowBootClaude(): { claude: string; cutBeforeBoot: string } {
  const cutBeforeBoot = test.info().outputPath("cut-before-boot");
  const claude = sessionClaude(`trap 'touch "${cutBeforeBoot}"; exit 143' TERM
sleep 3 & wait $!
trap - TERM
"${process.env[claudeExecutableVariable]}" "$@"
status=$?
sleep 1
${noteOutlivedApp}
exit $status
`);
  return { claude, cutBeforeBoot };
}

export const runningCount = (claude: string): number =>
  processLines("command=").filter((command) => command.includes(claude)).length;
