import {
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
  spawn,
} from "node:child_process";
import { R, type Result } from "../../../../../common/src/result";

export type CliCommand = {
  executable: string;
  env: NodeJS.ProcessEnv;
  /** The command's name in error messages, such as "claude". */
  name: string;
};

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

export const couldNotStart = (params: {
  executable: string;
  cwd: string;
  error: unknown;
}) =>
  R.failure(
    new Error(
      `couldn't start ${params.executable} in ${params.cwd}: ${R.toError(params.error).message}`,
    ),
  );

export async function spawnSessionCli(params: {
  executable: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<Result<ChildProcessWithoutNullStreams, Error>> {
  const { executable, cwd } = params;
  const child = spawn(executable, params.args, { cwd, env: params.env });
  const spawned = await new Promise<Result<void, Error>>((resolve) => {
    child.once("spawn", () => resolve(R.success(undefined)));
    child.once("error", (error) =>
      resolve(couldNotStart({ executable, cwd, error })),
    );
  });
  if (!spawned.ok) return spawned;
  closePipesAfterExit(child);
  return R.success(child);
}

/** An aborted signal sends the CLI SIGTERM, then SIGKILL if it outlives cancelKillAfterMs, and the result is a failure once it has exited. */
export function runCli(
  cli: CliCommand,
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
        env: cli.env,
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
          `${[cli.name, ...run.args].join(" ")} ${timedOut ? "timed out" : "was cancelled"}`,
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

/** Fails unless `<executable> --version` prints the expected version, which `pattern`'s first group captures from a line. */
export async function checkCliVersion(params: {
  cli: CliCommand;
  product: string;
  pattern: RegExp;
  expected: string;
  signal: AbortSignal;
}): Promise<Result<void, Error>> {
  const { cli, product, expected } = params;
  const exited = await runCli(cli, {
    args: ["--version"],
    signal: params.signal,
  });
  if (!exited.ok) return exited;
  if (exited.value.code !== 0)
    return R.failure(
      failureOutput(`${cli.executable} --version`, exited.value),
    );
  const found = params.pattern.exec(exited.value.stdout)?.[1];
  if (!found)
    return R.failure(
      withOutput(
        `${cli.executable} --version printed no ${product} version`,
        exited.value.stdout.trim() || exited.value.stderr,
      ),
    );
  return found === expected
    ? R.success(undefined)
    : R.failure(
        new Error(
          `${cli.executable} is ${product} ${found}, but Alliance agent supports only ${expected}`,
        ),
      );
}
