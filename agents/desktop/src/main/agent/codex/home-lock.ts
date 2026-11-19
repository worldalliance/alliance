import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { lock } from "proper-lockfile";
import { R, type Result } from "../../../../../../common/src/result";
import { hasCode } from "../../fs-error";
import { type CodexCli, createCodexHome } from "./process";

const pollMs = 500;

export const codexHomeLockPath = (home: string) =>
  path.join(home, "alliance-agent-setup.lock");

const takeLock = (cli: CodexCli) =>
  R.fromPromise(
    lock(cli.home, {
      lockfilePath: codexHomeLockPath(cli.home),
      // The default throws from a timer, which would crash the app; a setup already running can only finish unguarded.
      onCompromised: (error) =>
        console.error(
          `Alliance agent lost its lock on Codex's folder ${cli.home} during setup: ${error.message}`,
        ),
    }),
  );

// proper-lockfile's retries cover every error, so this polls only ELOCKED and returns any other error at once.
async function takeLockWithin(cli: CodexCli, waitMs: number) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const release = await takeLock(cli);
    if (
      release.ok ||
      !hasCode(release.error, "ELOCKED") ||
      Date.now() >= deadline
    )
      return release;
    await sleep(pollMs);
  }
}

/**
 * Runs `fn` holding a lock that every process setting up Codex in `cli.home` takes, the development apps of every checkout and the capture run included, since they share one home.
 * Waits up to `waitMs` in total, however many holders come before it, so one app running setups back to back can outlast the wait; a holder that dies leaves a lock that goes stale after proper-lockfile's 10 seconds.
 */
export async function withCodexHomeLock<T>(
  { cli, waitMs = 60_000 }: { cli: CodexCli; waitMs?: number },
  fn: () => Promise<Result<T, Error>>,
): Promise<Result<T, Error>> {
  const home = await createCodexHome(cli);
  if (!home.ok) return home;
  const release = R.mapError(
    await takeLockWithin(cli, waitMs),
    (error) =>
      new Error(
        hasCode(error, "ELOCKED")
          ? `Alliance agent couldn't lock Codex's folder ${cli.home} for setup within ${waitMs / 1000} seconds, so another Alliance agent may be setting Codex up there.`
          : `Alliance agent couldn't create its lock in Codex's folder ${cli.home}: ${error.message}`,
      ),
  );
  if (!release.ok) return release;
  try {
    return await fn();
  } finally {
    await release.value().catch((error: unknown) => {
      // ERELEASED follows a compromise, which onCompromised already logged.
      if (hasCode(error, "ERELEASED")) return;
      console.error(
        `Alliance agent couldn't release its lock on Codex's folder ${cli.home}: ${R.toError(error).message}`,
      );
    });
  }
}
