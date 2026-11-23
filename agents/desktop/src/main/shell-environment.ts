import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import { R, type Result } from "../../../../common/src/result";

const shellEnvironmentTimeoutMs = 30_000;

// Stop oh-my-zsh's update prompt and its tmux plugin from holding the shell open, as sindresorhus's shell-env does.
const quietProfile = {
  DISABLE_AUTO_UPDATE: "true",
  ZSH_TMUX_AUTOSTARTED: "true",
  ZSH_TMUX_AUTOSTART: "false",
};

const fileVariable = "ALLIANCE_AGENT_ENVIRONMENT_FILE";

// The shell's own working state and the variables the loader sets, rather than settings the user's profile makes.
const leftOut = new Set([
  "_",
  "PWD",
  "OLDPWD",
  "SHLVL",
  fileVariable,
  ...Object.keys(quietProfile),
]);

const parse = (printed: string) =>
  Object.fromEntries(
    printed
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const at = entry.indexOf("=");
        return [entry.slice(0, at), entry.slice(at + 1)] as const;
      })
      .filter(([name]) => !leftOut.has(name)),
  );

const loginShell = (env: NodeJS.ProcessEnv): Result<string, Error> => {
  if (env.SHELL) return R.success(env.SHELL);
  return R.flatMap(
    R.fromThrowable(() => userInfo().shell),
    (found) =>
      found ? R.success(found) : R.failure(new Error("no login shell is set")),
  );
};

// csh and tcsh take -l only as their sole flag, so they read their interactive startup files alone, as VS Code runs them.
const shellArgs = (shell: string) =>
  ["csh", "tcsh"].includes(path.basename(shell)) ? ["-ic"] : ["-i", "-l", "-c"];

/** The environment the user's interactive login shell sets up, as a terminal gets it. Aborting `signal` stops the shell. */
export function loadShellEnvironment(params: {
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<Result<Record<string, string>, Error>> {
  const found = loginShell(params.env);
  if (!found.ok) return Promise.resolve(found);
  const shell = found.value;
  const fail = (reason: string) => R.failure(new Error(`${shell} ${reason}`));
  if (params.signal?.aborted) return Promise.resolve(fail("was stopped"));
  // The environment goes to a file, since profile output and the processes a profile starts share stdout; stdout carries only the marker saying it is complete.
  const made = R.fromThrowable(() =>
    mkdtempSync(path.join(tmpdir(), "alliance-agent-shell-")),
  );
  if (!made.ok)
    return Promise.resolve(fail(`couldn't run: ${made.error.message}`));
  const dir = made.value;
  const file = path.join(dir, "env");
  const marker = `_ALLIANCE_AGENT_${randomUUID().replaceAll("-", "")}_`;
  return new Promise((resolve) => {
    // Absolute paths, since a profile can leave PATH without env or printf, which csh doesn't build in; the marker only follows a complete environment.
    const child = spawn(
      shell,
      [
        ...shellArgs(shell),
        `/usr/bin/env -0 > "$${fileVariable}" && /usr/bin/printf ${marker}`,
      ],
      {
        env: { ...params.env, ...quietProfile, [fileVariable]: file },
        stdio: ["ignore", "pipe", "ignore"],
        detached: true,
      },
    );
    const timeoutMs = params.timeoutMs ?? shellEnvironmentTimeoutMs;
    let settled = false;
    // The shell leads its own process group, so stopping the group also stops what the profile is stuck on and processes it left writing.
    const settle = (result: () => Result<Record<string, string>, Error>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", stop);
      child.stdout.destroy();
      const { pid } = child;
      // Throws once every process in the group has exited.
      if (pid !== undefined)
        R.fromThrowable(() => process.kill(-pid, "SIGKILL"));
      const value = result();
      const removed = R.fromThrowable(() =>
        rmSync(dir, { recursive: true, force: true }),
      );
      resolve(
        removed.ok
          ? value
          : fail(
              `left its environment in ${dir}, which couldn't be removed: ${removed.error.message}`,
            ),
      );
    };
    const stop = () => settle(() => fail("was stopped"));
    params.signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(
      () =>
        settle(() =>
          fail(`didn't print its environment within ${timeoutMs} ms`),
        ),
      timeoutMs,
    );
    // Only the end of stdout is kept, enough to find a marker split across chunks.
    let tail = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      const seen = tail + chunk;
      if (seen.includes(marker))
        settle(() =>
          R.map(
            R.fromThrowable(
              () => readFileSync(file, "utf8"),
              (error) =>
                new Error(
                  `${shell} printed no environment file: ${R.toError(error).message}`,
                ),
            ),
            parse,
          ),
        );
      tail = seen.slice(1 - marker.length);
    });
    child.once("error", (error) =>
      settle(() => fail(`couldn't start: ${error.message}`)),
    );
    // A failed exit settles at once; after a clean one the marker can still be in the pipe, and a profile process holding it open leaves that to the timeout.
    child.once("exit", (code, signal) => {
      if (code !== 0)
        settle(() =>
          fail(
            `exited with ${signal ?? `code ${code}`} before printing its environment`,
          ),
        );
    });
    child.once("close", () =>
      settle(() => fail("exited with code 0 before printing its environment")),
    );
  });
}
