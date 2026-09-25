import { spawn } from "child_process";
import { milliseconds } from "date-fns";
import process from "process";
import { run } from "./run-command";

type ChildProcessHandle = ReturnType<typeof spawn>;

export type SpawnOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

const childProcesses: ChildProcessHandle[] = [];

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const trackChildProcess = (child: ChildProcessHandle) => {
  childProcesses.push(child);
  child.on("close", () => {
    const index = childProcesses.indexOf(child);
    if (index >= 0) {
      childProcesses.splice(index, 1);
    }
  });
  return child;
};

export const spawnProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => {
  return trackChildProcess(
    spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      stdio: "inherit",
    }),
  );
};

export const runCommand = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => run(command, args, { ...options, onSpawn: trackChildProcess });

const killProcess = async (child: ChildProcessHandle) => {
  if (!child.pid || child.killed) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall back to regular kill below.
    }
  }

  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
};

export const shutdown = async (code: number) => {
  await Promise.all(childProcesses.map((child) => killProcess(child)));
  await delay(milliseconds({ seconds: 1 }));
  await Promise.all(
    childProcesses.map(async (child) => {
      if (!child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          // Ignore.
        }
      }
    }),
  );
  process.exit(code);
};

export const waitForHttp = async (url: string, timeoutMs: number) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        return;
      }
    } catch {
      // Ignore until timeout.
    }
    await delay(milliseconds({ seconds: 1 }));
  }
  throw new Error(`Timed out waiting for ${url}`);
};
