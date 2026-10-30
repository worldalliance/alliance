import type { Subprocess } from "bun";
import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = join(import.meta.dir, "worktree-lock.sh");

let dir: string;
let lock: string;
const procs: Subprocess[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "worktree-lock-"));
  mkdirSync(join(dir, "rec"));
  lock = join(dir, "rec", "lock");
});

afterEach(() => {
  for (const proc of procs.splice(0)) proc.kill(9);
  if (existsSync(join(dir, "sealed"))) chmodSync(join(dir, "sealed"), 0o755);
  rmSync(dir, { recursive: true, force: true });
});

function take(params: {
  then: string;
  path?: string;
  stderrFile?: string;
  binDir?: string;
  orElse?: string;
}) {
  const redirect = params.stderrFile ? `exec 2>"${params.stderrFile}"; ` : "";
  const bin = params.binDir ? `PATH="${params.binDir}:$PATH"; ` : "";
  const orElse = params.orElse ? ` || { ${params.orElse}; }` : "";
  const proc = Bun.spawn(
    [
      "bash",
      "-c",
      `set -euo pipefail; ${redirect}${bin}source "${LIB}"; acquire_lock "${params.path ?? lock}" "the lock" 8${orElse}; ${params.then}`,
    ],
    { stdin: "pipe", stderr: "pipe", stdout: "pipe" },
  );
  procs.push(proc);
  return proc;
}

async function until(file: string): Promise<void> {
  while (!existsSync(join(dir, file))) await Bun.sleep(50);
}

// The builtin read keeps the lock in the holder's shell alone; a child such as
// sleep would inherit the descriptor and hold the lock past the holder.
const holdUntilGo = () =>
  `touch "${dir}/held"; until [[ -e "${dir}/go" || ! -d "${dir}" ]]; do read -r -t 1 || true; done`;

function waiter(params: { then: string; orElse?: string }) {
  return take({ ...params, stderrFile: join(dir, "waiter.err") });
}

// Exits 9 when a failed acquire_lock left descriptor 8 open.
const exitClosed = `status=$?; { true >&8; } 2>/dev/null && exit 9; exit $status`;

async function waiting(): Promise<string> {
  const file = join(dir, "waiter.err");
  while (!existsSync(file) || !readFileSync(file, "utf8").includes("waiting")) {
    await Bun.sleep(50);
  }
  return readFileSync(file, "utf8");
}

test("a waiter takes the lock only after its holder releases it", async () => {
  const holder = take({
    then: `${holdUntilGo()}; touch "${dir}/released"; release_lock 8`,
  });
  await until("held");

  const waiterProc = waiter({ then: `test -e "${dir}/released"` });
  const stderr = await waiting();
  writeFileSync(join(dir, "go"), "");

  expect(stderr).toContain("waiting for another run to release the lock");
  expect(await waiterProc.exited).toBe(0);
  expect(await holder.exited).toBe(0);
}, 30_000);

test("a waiter whose lock's directory is removed while it waits does not take it", async () => {
  const holder = take({
    then: `${holdUntilGo()}; mv "${dir}/rec" "${dir}/gone"; release_lock 8`,
  });
  await until("held");

  const waiterProc = waiter({ then: "true" });
  await waiting();
  writeFileSync(join(dir, "go"), "");

  expect(await waiterProc.exited).toBe(1);
  expect(await holder.exited).toBe(0);
}, 30_000);

test("a waiter whose lock file is replaced while it waits fails loudly", async () => {
  const holder = take({
    then: `${holdUntilGo()}; rm "${lock}"; touch "${lock}"; release_lock 8`,
  });
  await until("held");

  const waiterProc = waiter({ then: "true", orElse: exitClosed });
  await waiting();
  writeFileSync(join(dir, "go"), "");

  expect(await waiterProc.exited).toBe(2);
  expect(readFileSync(join(dir, "waiter.err"), "utf8")).toContain(
    "was removed or replaced while waiting",
  );
  expect(await holder.exited).toBe(0);
}, 30_000);

test("a holder killed outright leaves no lock behind", async () => {
  const holder = take({ then: `touch "${dir}/held"; read -r -t 60 || true` });
  await until("held");
  holder.kill(9);
  await holder.exited;

  const next = take({ then: "true" });
  const timeout = setTimeout(() => next.kill(), 10_000);
  const exitCode = await next.exited;
  clearTimeout(timeout);

  expect(exitCode).toBe(0);
  expect(await new Response(next.stderr).text()).not.toContain("waiting");
}, 30_000);

test("a lock whose directory is gone is not taken", async () => {
  const next = take({ then: "true", path: join(dir, "gone", "lock") });

  expect(await next.exited).toBe(1);
});

test("a lock that cannot be opened fails loudly instead of reading as gone", async () => {
  mkdirSync(lock);
  const next = take({ then: "true" });

  expect(await next.exited).toBe(2);
  const stderr = await new Response(next.stderr).text();
  expect(stderr).toContain(`could not open ${lock}`);
  expect(stderr).toContain("Is a directory");
});

test("a lock whose directory cannot be reached fails loudly instead of reading as gone", async () => {
  mkdirSync(join(dir, "sealed", "rec"), { recursive: true });
  chmodSync(join(dir, "sealed"), 0);
  const sealed = join(dir, "sealed", "rec", "lock");
  const next = take({ then: "true", path: sealed });

  expect(await next.exited).toBe(2);
  expect(await new Response(next.stderr).text()).toContain(
    `could not open ${sealed}: Permission denied`,
  );
});

test("a lock that cannot be taken names the cause on its error line", async () => {
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "perl"),
    '#!/bin/sh\necho "No locks available" >&2\nexit 4\n',
    { mode: 0o755 },
  );
  const next = take({ then: "true", binDir: bin, orElse: exitClosed });

  expect(await next.exited).toBe(2);
  expect(await new Response(next.stderr).text()).toBe(
    `error: could not lock ${lock}: No locks available\n`,
  );
});

test("a lock whose open failure clears before it is examined is taken", async () => {
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const missing = join(dir, "late");
  writeFileSync(
    join(bin, "perl"),
    `#!/bin/sh\n[ "$1" = -e ] || exec /usr/bin/perl "$@"\nmkdir -p "${missing}"\nexit 1\n`,
    { mode: 0o755 },
  );
  const next = take({ then: "true", path: join(missing, "lock"), binDir: bin });

  expect(await next.exited).toBe(0);
  expect(await new Response(next.stderr).text()).toBe("");
});
