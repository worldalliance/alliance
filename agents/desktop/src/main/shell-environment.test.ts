import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import { R } from "../../../../common/src/result";
import { loadShellEnvironment } from "./shell-environment";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const fakeShell = (body: string, name = "shell") => {
  dir = mkdtempSync(path.join(tmpdir(), "shell-env-test-"));
  const shell = path.join(dir, name);
  writeFileSync(shell, `#!/bin/sh\n${body}\n`);
  chmodSync(shell, 0o755);
  return shell;
};

const lastArgument = 'for command; do :; done; exec /bin/sh -c "$command"';

const alive = (pid: number) =>
  spawnSync("kill", ["-0", String(pid)]).status === 0;
// A killed process stays visible until it is reaped.
const living = async (pids: number[]) => {
  const deadline = Date.now() + 5_000;
  while (pids.some(alive) && Date.now() < deadline) await Bun.sleep(50);
  return pids.filter(alive);
};
const pids = (file: string) =>
  readFileSync(path.join(dir, file), "utf8").trim().split("\n").map(Number);

// Assigning undefined to an environment variable stores the string "undefined".
const withTmpdir = async (folder: string, run: () => Promise<void>) => {
  const before = process.env.TMPDIR;
  process.env.TMPDIR = folder;
  try {
    await run();
  } finally {
    if (before === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = before;
  }
};

test("the environment the login shell's profile sets, without the shell's own state or the variables quieting the profile", async () => {
  const shell = fakeShell(
    `echo "Welcome"\nexport PATH="/profile/bin:$PATH" MULTI="a\nb=c"\n${lastArgument}`,
  );
  const loaded = await loadShellEnvironment({
    env: { SHELL: shell, PATH: "/usr/bin:/bin", HOME: dir },
  });
  expect(loaded).toEqual(
    R.success({
      SHELL: shell,
      PATH: "/profile/bin:/usr/bin:/bin",
      HOME: dir,
      MULTI: "a\nb=c",
    }),
  );
});

test("a shell that exits without printing its environment fails, naming the shell and its exit", async () => {
  const shell = fakeShell("exit 3");
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
    }),
  ).toEqual(
    R.failure(
      new Error(`${shell} exited with code 3 before printing its environment`),
    ),
  );
});

test("a shell that exits cleanly without printing its environment fails at once", async () => {
  const shell = fakeShell("exit 0");
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
      timeoutMs: 60_000,
    }),
  ).toEqual(
    R.failure(
      new Error(`${shell} exited with code 0 before printing its environment`),
    ),
  );
});

test("without SHELL, the passwd entry's shell is the login shell", async () => {
  dir = mkdtempSync(path.join(tmpdir(), "shell-env-test-"));
  expect(
    await loadShellEnvironment({
      env: { PATH: "/usr/bin:/bin" },
      signal: AbortSignal.abort(),
    }),
  ).toEqual(R.failure(new Error(`${userInfo().shell} was stopped`)));
});

test("a shell whose environment command fails fails rather than returning an empty environment", async () => {
  const shell = fakeShell(
    'for command; do :; done; exec /bin/sh -c "$(echo "$command" | sed s,/usr/bin/env,/usr/bin/false,)"',
  );
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
    }),
  ).toEqual(
    R.failure(
      new Error(`${shell} exited with code 1 before printing its environment`),
    ),
  );
});

test("output a profile process keeps writing leaves the environment whole, and the process stops once it arrives", async () => {
  const shell = fakeShell(
    `(while printf 'noise\\0'; do :; done) &\necho $! > "$(dirname "$0")/writer"\n${lastArgument}`,
  );
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
    }),
  ).toEqual(R.success({ SHELL: shell, PATH: "/usr/bin:/bin" }));
  expect(await living(pids("writer"))).toEqual([]);
});

test("a shell that hangs fails once the timeout passes, stopping what it started, even a process holding its output open", async () => {
  const shell = fakeShell(
    'sleep 30 &\necho $! > "$(dirname "$0")/sleeps"\nsleep 30 &\necho $! >> "$(dirname "$0")/sleeps"\nwait',
  );
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
      timeoutMs: 2_000,
    }),
  ).toEqual(
    R.failure(
      new Error(`${shell} didn't print its environment within 2000 ms`),
    ),
  );
  expect(await living(pids("sleeps"))).toEqual([]);
});

test("a shell that fails while a process it started holds its output open fails at once, with its exit", async () => {
  const shell = fakeShell("sleep 30 &\nexit 3");
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
      timeoutMs: 5_000,
    }),
  ).toEqual(
    R.failure(
      new Error(`${shell} exited with code 3 before printing its environment`),
    ),
  );
});

test("aborting the load stops the shell", async () => {
  const shell = fakeShell('echo $$ > "$(dirname "$0")/shell-pid"\nsleep 30');
  const abort = new AbortController();
  const loaded = loadShellEnvironment({
    env: { SHELL: shell, PATH: "/usr/bin:/bin" },
    signal: abort.signal,
  });
  while (!existsSync(path.join(dir, "shell-pid"))) await Bun.sleep(20);
  abort.abort();
  expect(await loaded).toEqual(R.failure(new Error(`${shell} was stopped`)));
  expect(await living(pids("shell-pid"))).toEqual([]);
});

test("csh and tcsh run with -ic, since they reject -l beside other flags", async () => {
  const shell = fakeShell(`[ "$1" = -ic ] || exit 9\n${lastArgument}`, "tcsh");
  const loaded = await loadShellEnvironment({
    env: { SHELL: shell, PATH: "/usr/bin:/bin" },
  });
  expect(loaded.ok).toBe(true);
});

test("variables named like Object's own properties pass", async () => {
  const shell = fakeShell(lastArgument);
  const loaded = await loadShellEnvironment({
    env: { SHELL: shell, PATH: "/usr/bin:/bin", constructor: "set" },
  });
  expect(loaded.ok && loaded.value["constructor"]).toBe("set");
});

test("a shell that can't start fails, saying why", async () => {
  dir = mkdtempSync(path.join(tmpdir(), "shell-env-test-"));
  const shell = path.join(dir, "missing");
  const loaded = await loadShellEnvironment({ env: { SHELL: shell } });
  expect(!loaded.ok && loaded.error.message).toStartWith(
    `${shell} couldn't start:`,
  );
});

test("a signal already aborted fails without starting the shell", async () => {
  const shell = fakeShell(`touch "$(dirname "$0")/started"\n${lastArgument}`);
  expect(
    await loadShellEnvironment({
      env: { SHELL: shell, PATH: "/usr/bin:/bin" },
      signal: AbortSignal.abort(),
    }),
  ).toEqual(R.failure(new Error(`${shell} was stopped`)));
  expect(existsSync(path.join(dir, "started"))).toBe(false);
});

test("a temporary folder whose path has a quote in it holds the environment", async () => {
  const shell = fakeShell(lastArgument);
  const quoted = path.join(dir, "it's");
  mkdirSync(quoted);
  await withTmpdir(quoted, async () => {
    expect(
      await loadShellEnvironment({
        env: { SHELL: shell, PATH: "/usr/bin:/bin" },
      }),
    ).toEqual(R.success({ SHELL: shell, PATH: "/usr/bin:/bin" }));
  });
});

test("an environment left on disk fails the load, naming its folder", async () => {
  const shell = fakeShell(
    'for command; do :; done\nprinted=$(/bin/sh -c "$command")\nchmod 500 "$(dirname "$ALLIANCE_AGENT_ENVIRONMENT_FILE")"\nprintf %s "$printed"',
  );
  const temporary = path.join(dir, "tmp");
  mkdirSync(temporary);
  try {
    await withTmpdir(temporary, async () => {
      const loaded = await loadShellEnvironment({
        env: { SHELL: shell, PATH: "/usr/bin:/bin" },
      });
      expect(!loaded.ok && loaded.error.message).toStartWith(
        `${shell} left its environment in ${temporary}/alliance-agent-shell-`,
      );
    });
  } finally {
    for (const left of readdirSync(temporary))
      chmodSync(path.join(temporary, left), 0o700);
  }
});
