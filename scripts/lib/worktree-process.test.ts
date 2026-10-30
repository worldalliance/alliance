import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = join(import.meta.dir, "worktree-process.sh");

function bash(script: string, env: Record<string, string> = {}) {
  return spawnSync("bash", ["-c", `source "${LIB}"; ${script}`], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

const unpinned = (env: Record<string, string>) =>
  bash(`ps -o lstart= -p ${process.pid}`, env).stdout;

function readsAliveAcross(
  holder: Record<string, string>,
  reader: Record<string, string>,
) {
  expect(unpinned(holder)).not.toBe(unpinned(reader));
  const stamp = bash(`process_stamp ${process.pid}`, holder).stdout.replace(
    /\n$/,
    "",
  );
  expect(stamp).toStartWith(`${process.pid} `);
  expect(bash(`stamp_alive "${stamp}"`, reader).status).toBe(0);
}

test("a stamp written in one time zone reads as alive in another", () => {
  readsAliveAcross(
    { LC_ALL: "C", TZ: "America/Los_Angeles" },
    { LC_ALL: "C", TZ: "UTC" },
  );
});

const frenchInstalled =
  unpinned({ LC_ALL: "fr_FR.UTF-8", TZ: "UTC" }) !==
  unpinned({ LC_ALL: "C", TZ: "UTC" });

test.skipIf(!frenchInstalled)(
  "a stamp written in one locale reads as alive in another",
  () => {
    readsAliveAcross(
      { LC_ALL: "fr_FR.UTF-8", TZ: "UTC" },
      { LC_ALL: "C", TZ: "UTC" },
    );
  },
);

test("a stamp reads as dead once its process exits", () => {
  const result = bash(
    `sleep 5 & p=$!; s="$(process_stamp $p)" && stamp_alive "$s" || exit 2; kill $p; wait $p || true; stamp_alive "$s"`,
  );

  expect(result.status).toBe(1);
});

test("a live pid with a different start time reads as dead, as after pid reuse", () => {
  expect(
    bash(`stamp_alive "${process.pid} Thu Jan  1 00:00:00 2026"`).status,
  ).toBe(1);
});

test("a zombie has no stamp", () => {
  const result = bash(
    `exec 3< <(sh -c 'true & echo $!; exec sleep 3'); read -r p <&3; sleep 0.5; [[ "$(ps -o stat= -p $p)" == Z* ]] || exit 2; process_stamp $p`,
  );

  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
});

test("a pid with no process has no stamp", () => {
  const result = bash("process_stamp 99999999");

  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
});

test("an empty stamp reads as dead", () => {
  expect(bash(`stamp_alive ""`).status).toBe(1);
});

test("a process whose name holds parentheses and spaces is stamped", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-process-"));
  const sleeper = join(dir, "a) Z b");
  // Linux takes a script's comm from its filename. The shebang names bash
  // directly because env would re-exec and reset comm. The script blocks on a
  // fifo, not sleep, so kill leaves no child.
  writeFileSync(sleeper, '#!/bin/bash\nexec 3<>"$1"; read -t 5 <&3\n', {
    mode: 0o755,
  });
  try {
    const result = bash(
      `mkfifo "${dir}/fifo"; "${sleeper}" "${dir}/fifo" & p=$!
      if [[ -r /proc/$p/comm ]]; then
        for _ in {1..50}; do [[ "$(</proc/$p/comm)" == "a) Z b" ]] && break; sleep 0.1; done
        [[ "$(</proc/$p/comm)" == "a) Z b" ]] || exit 3
      fi
      s="$(process_stamp $p)" && stamp_alive "$s" || exit 2; kill $p; wait $p || true; stamp_alive "$s"`,
    );

    expect(result.status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
