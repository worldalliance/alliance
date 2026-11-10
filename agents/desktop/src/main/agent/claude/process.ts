import { type ChildProcess, spawn } from "node:child_process";
import { R, type Result } from "../../../../../../common/src/result";
import { CLAUDE_CODE_VERSION } from "./protocol";

export type ClaudeCli = {
  executable: string;
  /** The app-private CLAUDE_CONFIG_DIR, holding the CLI's settings, sign-in and session history. */
  configDir: string;
};

// The CLI reads its settings, credentials, endpoint and nested-session markers from these two namespaces, so none of them pass through.
// The desktop-app task's Credentials decision removes OPENAI_API_KEY from every agent process.
const inherited = (name: string) =>
  !name.startsWith("CLAUDE") &&
  !name.startsWith("ANTHROPIC_") &&
  name !== "OPENAI_API_KEY";

export function claudeEnvironment(
  configDir: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(base).filter(([name]) => inherited(name)),
    ),
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    DISABLE_UPDATES: "1",
  };
}

export type Exited = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export const cancelKillAfterMs = 2_000;
const pipesCloseAfterExitMs = 1_000;

/** A descendant can hold the CLI's pipes open after it exits, which keeps "close" from firing; this ends them shortly after the exit. */
export function closePipesAfterExit(child: ChildProcess): void {
  child.once("exit", () =>
    setTimeout(() => {
      child.stdout?.destroy();
      child.stderr?.destroy();
    }, pipesCloseAfterExitMs).unref(),
  );
}

/** An aborted signal sends the CLI SIGTERM, then SIGKILL if it outlives cancelKillAfterMs, and the result is a failure once it has exited. */
export function runClaude(
  cli: ClaudeCli,
  run: { args: readonly string[]; signal?: AbortSignal },
): Promise<Result<Exited, Error>> {
  return new Promise((resolve) => {
    const couldNotRun = (error: unknown) =>
      R.failure(
        new Error(
          `couldn't run ${cli.executable}: ${R.toError(error).message}`,
        ),
      );
    const spawned = R.fromThrowable(() =>
      spawn(cli.executable, run.args, {
        env: claudeEnvironment(cli.configDir),
        stdio: ["ignore", "pipe", "pipe"],
        signal: run.signal,
      }),
    );
    if (!spawned.ok) return resolve(couldNotRun(spawned.error));
    const child = spawned.value;
    closePipesAfterExit(child);
    const cancelled = () => {
      const reason = run.signal?.reason;
      const timedOut =
        reason instanceof DOMException && reason.name === "TimeoutError";
      return R.failure(
        new Error(
          `${["claude", ...run.args].join(" ")} ${timedOut ? "timed out" : "was cancelled"}`,
        ),
      );
    };
    let kill: ReturnType<typeof setTimeout> | undefined;
    const escalate = () => {
      kill = setTimeout(() => child.kill("SIGKILL"), cancelKillAfterMs);
      kill.unref();
    };
    if (run.signal?.aborted) escalate();
    else run.signal?.addEventListener("abort", escalate, { once: true });
    // An abort after the CLI exits, while a process it started holds the pipes, cancels nothing.
    let abortedAtExit: boolean | undefined;
    child.once("exit", () => {
      abortedAtExit = run.signal?.aborted;
      clearTimeout(kill);
      run.signal?.removeEventListener("abort", escalate);
    });
    let stdout = "";
    let stderr = "";
    // Node leaves the pipes unset when spawn fails with EMFILE, which the error handler reports.
    child.stdout?.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr?.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.once("error", (error) => {
      if (!run.signal?.aborted) resolve(couldNotRun(error));
    });
    child.once("close", (code, signal) =>
      resolve(
        (abortedAtExit ?? run.signal?.aborted)
          ? cancelled()
          : R.success({ code, signal, stdout, stderr }),
      ),
    );
  });
}

function withOutput(message: string, output: string): Error {
  const tail = output.trim().slice(-2000);
  return new Error(tail ? `${message}: ${tail}` : message);
}

export function failureOutput(command: string, exited: Exited): Error {
  const ending =
    exited.code === null
      ? `was killed by ${exited.signal}`
      : `exited with code ${exited.code}`;
  return withOutput(
    `${command} ${ending}`,
    exited.stderr.trim() || exited.stdout,
  );
}

export const queryTimeoutMs = 10_000;

export async function checkClaudeVersion(
  cli: ClaudeCli,
  signal = AbortSignal.timeout(queryTimeoutMs),
): Promise<Result<void, Error>> {
  const exited = await runClaude(cli, { args: ["--version"], signal });
  if (!exited.ok) return exited;
  if (exited.value.code !== 0)
    return R.failure(
      failureOutput(`${cli.executable} --version`, exited.value),
    );
  const found = /^(\S+) \(Claude Code\)$/m.exec(exited.value.stdout)?.[1];
  if (!found)
    return R.failure(
      withOutput(
        `${cli.executable} --version printed no Claude Code version`,
        exited.value.stdout.trim() || exited.value.stderr,
      ),
    );
  return found === CLAUDE_CODE_VERSION
    ? R.success(undefined)
    : R.failure(
        new Error(
          `${cli.executable} is Claude Code ${found}, but Alliance agent supports only ${CLAUDE_CODE_VERSION}`,
        ),
      );
}
