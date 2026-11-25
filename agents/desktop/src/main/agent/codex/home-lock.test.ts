import { afterAll, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { lock } from "proper-lockfile";
import { R } from "../../../../../../common/src/result";
import { testFolders } from "../testing/folders";
import { codexHomeLockPath, withCodexHomeLock } from "./home-lock";

const scratch = mkdtempSync(path.join(tmpdir(), "codex-home-lock-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const cliIn = (name: string) => ({
  executable: "codex",
  folders: testFolders({ codexHome: path.join(scratch, name) }),
});

test("creates the home and runs the setup holding the lock, then releases it", async () => {
  const cli = cliIn("fresh");
  expect(
    await withCodexHomeLock({ cli }, async () => R.success("set up")),
  ).toEqual(R.success("set up"));
  expect(
    await withCodexHomeLock({ cli }, async () =>
      R.failure(new Error("failed")),
    ),
  ).toEqual(R.failure(new Error("failed")));
  await expect(
    withCodexHomeLock({ cli }, () => Promise.reject(new Error("thrown"))),
  ).rejects.toThrow("thrown");
  expect(
    await withCodexHomeLock({ cli, waitMs: 0 }, async () => R.success("again")),
  ).toEqual(R.success("again"));
});

test("waits for another process's setup, then fails loudly once the wait runs out", async () => {
  const cli = cliIn("held");
  mkdirSync(cli.folders.codexHome);
  const release = await lock(cli.folders.codexHome, {
    lockfilePath: codexHomeLockPath(cli.folders.codexHome),
  });
  const ran: string[] = [];
  const waiting = withCodexHomeLock({ cli }, async () => {
    ran.push("waiting");
    return R.success(undefined);
  });
  const result = await withCodexHomeLock({ cli, waitMs: 600 }, async () => {
    ran.push("timed out");
    return R.success(undefined);
  });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.message).toStartWith(
    `Alliance agent couldn't lock Codex's folder ${cli.folders.codexHome} for setup within 0.6 seconds, so another Alliance agent may be setting Codex up there`,
  );
  await release();
  expect(await waiting).toEqual(R.success(undefined));
  expect(ran).toEqual(["waiting"]);
});

test("names the cause, not another agent, when it can't create the lock", async () => {
  const cli = cliIn("read-only");
  mkdirSync(cli.folders.codexHome, { mode: 0o500 });
  const started = Date.now();
  const result = await withCodexHomeLock({ cli }, async () => R.success(1));
  expect(Date.now() - started).toBeLessThan(1_000);
  expect(!result.ok && result.error.message).toStartWith(
    `Alliance agent couldn't create its lock in Codex's folder ${cli.folders.codexHome}: EACCES`,
  );
});

test("takes over a lock its holder left behind once it is stale", async () => {
  const cli = cliIn("stale");
  mkdirSync(codexHomeLockPath(cli.folders.codexHome), { recursive: true });
  const old = new Date(Date.now() - 60_000);
  utimesSync(codexHomeLockPath(cli.folders.codexHome), old, old);
  expect(
    await withCodexHomeLock({ cli, waitMs: 0 }, async () => R.success(1)),
  ).toEqual(R.success(1));
});

test("logs a lost lock once and still returns the setup's result", async () => {
  const cli = cliIn("compromised");
  const logged = spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await withCodexHomeLock({ cli }, async () => {
      rmSync(codexHomeLockPath(cli.folders.codexHome), { recursive: true });
      await Bun.sleep(6_000);
      return R.success(1);
    });
    expect(result).toEqual(R.success(1));
    expect(logged.mock.calls).toEqual([
      [
        expect.stringMatching(
          /^Alliance agent lost its lock on Codex's folder .+ during setup/,
        ),
      ],
    ]);
  } finally {
    logged.mockRestore();
  }
}, 10_000);
