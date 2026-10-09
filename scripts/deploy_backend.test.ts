import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "deploy_backend.sh");

// Each stub logs what it was asked to do. The database is one word in
// state/db, the running release one word in state/pm2, and a release is the
// word in its directory's `release` file.
const STUBS: Record<string, string> = {
  flock: `
    echo flock >> "$STATE/log"
    [ "\${LOCK:-ok}" = ok ]`,
  sleep: "exit 0",
  unzip: `
    dir="\${@: -1}"
    mkdir -p "$dir/server"
    echo new > "$dir/release"
    echo unzip >> "$STATE/log"`,
  bun: `
    case "$1 \${2:-}" in
      "install --frozen-lockfile")
        echo install >> "$STATE/log"
        [ "\${INSTALL:-ok}" = ok ];;
      "scripts/streak-recognition-removal.ts state")
        [ ! -e "$STATE/unreadable" ] || exit 1
        [ ! -e "$STATE/slow" ] || echo "query is slow: SELECT 1"
        cat "$STATE/db";;
      "scripts/streak-recognition-removal.ts revert")
        echo revert >> "$STATE/log"
        [ "\${REVERT:-ok}" = ok ] || exit 1
        echo pending > "$STATE/db";;
      *) echo "unexpected bun $*" >&2; exit 2;;
    esac`,
  bunx: `
    echo "migrate while running: $(cat "$STATE/pm2")" >> "$STATE/log"
    [ "$(cat "$STATE/db")" = pending ] || { [ "\${MIGRATE:-ok}" = ok ]; exit; }
    case "\${MIGRATE:-ok}" in
      ok) echo applied > "$STATE/db";;
      guard) echo "Streak recognition is still in use" >&2; exit 1;;
      disconnect) echo applied > "$STATE/db"; exit 1;;
      unknown) touch "$STATE/unreadable"; exit 1;;
      slow) echo applied > "$STATE/db"; touch "$STATE/slow"; exit 1;;
      interrupt) kill -TERM "$PPID";;
      interrupt-after-commit) echo applied > "$STATE/db"; kill -TERM "$PPID";;
    esac`,
  pm2: `
    if { : >&9; } 2>/dev/null; then echo "pm2 inherited the lock fd" >&2; exit 3; fi
    case "$1" in
      delete)
        echo "delete $(cat "$STATE/pm2")" >> "$STATE/log"
        [ "\${STOP:-ok}" = ok ] || exit 1
        [ -n "$(cat "$STATE/pm2")" ] || exit 1
        : > "$STATE/pm2";;
      start)
        release=$(cat ../release)
        echo "start $release" >> "$STATE/log"
        [ "$release" != old ] || [ "\${START_OLD:-ok}" = ok ] || exit 1
        echo "$release" > "$STATE/pm2";;
      jlist)
        if [ -n "$(cat "$STATE/pm2")" ]; then echo '[{"name":"nest-app"}]'; else echo '[]'; fi;;
      save) ;;
      *) echo "unexpected pm2 $*" >&2; exit 2;;
    esac`,
  curl: `
    running=$(cat "$STATE/pm2")
    echo "health $running" >> "$STATE/log"
    [ "$running" != new ] || [ "\${HEALTH:-ok}" = ok ]`,
};

let home: string;
let state: string;
let bin: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "deploy-backend-"));
  state = join(home, "state");
  bin = join(home, "bin");
  mkdirSync(state);
  mkdirSync(bin);
  mkdirSync(join(home, "nest-backend", "server"), { recursive: true });
  writeFileSync(join(home, "nest-backend", "release"), "old\n");
  writeFileSync(join(state, "pm2"), "old\n");
  writeFileSync(join(state, "log"), "");
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
});

afterEach(() => {
  rmSync(home, { recursive: true });
});

function deploy(env: Record<string, string> = {}) {
  const result = Bun.spawnSync(["bash", SCRIPT], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: home,
      STATE: state,
      ...env,
    },
  });
  const read = (file: string) => readFileSync(join(state, file), "utf8").trim();
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
    log: read("log").split("\n"),
    running: read("pm2"),
    db: read("db"),
    release: readFileSync(join(home, "nest-backend", "release"), "utf8").trim(),
  };
}

const setDb = (value: "absent" | "applied" | "pending") =>
  writeFileSync(join(state, "db"), `${value}\n`);

describe.each(["absent", "applied"] as const)(
  "deploy_backend.sh with the removal %s",
  (removal) => {
    beforeEach(() => setDb(removal));

    test("migrates with the old backend up, then swaps in the new one", () => {
      const result = deploy();
      expect(result.exitCode).toBe(0);
      expect(result.log).toEqual([
        "flock",
        "unzip",
        "install",
        "migrate while running: old",
        "delete old",
        "start new",
        "health new",
      ]);
      expect(result.running).toBe("new");
    });

    test("a failed install restarts the old release without migrating", () => {
      const result = deploy({ INSTALL: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.log).not.toContainEqual(expect.stringMatching(/^migrate/));
      expect(result).toMatchObject({ running: "old", release: "old" });
    });

    test("a failed migration restarts the old release", () => {
      const result = deploy({ MIGRATE: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result).toMatchObject({ running: "old", release: "old" });
    });

    test("a failed health check restarts the old release", () => {
      const result = deploy({ HEALTH: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.log.slice(-3)).toEqual([
        "delete new",
        "delete ",
        "start old",
      ]);
      expect(result).toMatchObject({ running: "old", release: "old" });
    });
  },
);

test("deploy_backend.sh fails on an unreadable removal state without migrating", () => {
  setDb("pending");
  writeFileSync(join(state, "unreadable"), "");
  const result = deploy();
  expect(result.exitCode).toBe(1);
  expect(result.log).not.toContainEqual(expect.stringMatching(/^migrate/));
  expect(result).toMatchObject({
    running: "old",
    release: "old",
    db: "pending",
  });
});

test("deploy_backend.sh fails on an unrecognized removal state without migrating", () => {
  setDb("pending");
  writeFileSync(join(state, "slow"), "");
  const result = deploy();
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    "Unexpected streak recognition removal state",
  );
  expect(result.log).not.toContainEqual(expect.stringMatching(/^migrate/));
  expect(result).toMatchObject({
    running: "old",
    release: "old",
    db: "pending",
  });
});

describe("deploy_backend.sh with the removal pending", () => {
  beforeEach(() => setDb("pending"));

  test("stops the old backend before migrating and starts the new one", () => {
    const result = deploy();
    expect(result.exitCode).toBe(0);
    expect(result.log).toEqual([
      "flock",
      "unzip",
      "install",
      "delete old",
      "migrate while running: ",
      "delete ",
      "start new",
      "health new",
    ]);
    expect(result).toMatchObject({ running: "new", db: "applied" });
  });

  test("a preparation failure keeps the old backend and migrates nothing", () => {
    const result = deploy({ INSTALL: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.log).not.toContainEqual(expect.stringMatching(/^migrate/));
    expect(result).toMatchObject({
      running: "old",
      release: "old",
      db: "pending",
    });
  });

  test("a backend that won't stop is restarted on the old release, unmigrated", () => {
    const result = deploy({ STOP: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.log).not.toContainEqual(expect.stringMatching(/^migrate/));
    expect(result).toMatchObject({
      running: "old",
      release: "old",
      db: "pending",
    });
  });

  test("the usage guard fails the deploy and restarts the old release", () => {
    const result = deploy({ MIGRATE: "guard" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Streak recognition is still in use");
    expect(result.log).not.toContain("revert");
    expect(result).toMatchObject({
      running: "old",
      release: "old",
      db: "pending",
    });
  });

  test("an old release that won't restart after the guard fails says the backend is left stopped", () => {
    const result = deploy({ MIGRATE: "guard", START_OLD: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("The backend is left stopped");
    expect(result).toMatchObject({ running: "", db: "pending" });
  });

  test("a failed health check reverts the removal before restarting the old release", () => {
    const result = deploy({ HEALTH: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.log.slice(-7)).toEqual([
      "start new",
      "health new",
      "delete new",
      "revert",
      "delete ",
      "delete ",
      "start old",
    ]);
    expect(result).toMatchObject({
      running: "old",
      release: "old",
      db: "pending",
    });
  });

  test("a migration that commits and then loses its connection is reverted too", () => {
    const result = deploy({ MIGRATE: "disconnect" });
    expect(result.exitCode).toBe(1);
    expect(result.log.slice(-4)).toEqual([
      "revert",
      "delete ",
      "delete ",
      "start old",
    ]);
    expect(result).toMatchObject({ running: "old", db: "pending" });
  });

  test("an interrupt before the removal commits restarts the old release", () => {
    const result = deploy({ MIGRATE: "interrupt" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("The deploy was interrupted before");
    expect(result.log).not.toContain("revert");
    expect(result).toMatchObject({
      running: "old",
      release: "old",
      db: "pending",
    });
  });

  test("an interrupt after the removal commits reverts it before restarting the old release", () => {
    const result = deploy({ MIGRATE: "interrupt-after-commit" });
    expect(result.exitCode).toBe(1);
    expect(result.log).toContain("revert");
    expect(result).toMatchObject({
      running: "old",
      release: "old",
      db: "pending",
    });
  });

  test("a deploy after a recovery runs the removal again", () => {
    expect(deploy({ HEALTH: "fail" }).exitCode).toBe(1);
    const retry = deploy();
    expect(retry.exitCode).toBe(0);
    expect(retry).toMatchObject({
      running: "new",
      release: "new",
      db: "applied",
    });
  });

  test("a failed revert leaves the backend stopped and says so", () => {
    const result = deploy({ HEALTH: "fail", REVERT: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("The backend is left stopped");
    expect(result.log).not.toContain("start old");
    expect(result).toMatchObject({ running: "", db: "applied" });
  });

  test("an unrecognized outcome after a failed migration leaves the backend stopped", () => {
    const result = deploy({ MIGRATE: "slow" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("outcome could not be read");
    expect(result.log).not.toContain("revert");
    expect(result.running).toBe("");
  });

  test("an unreadable outcome after a failed migration leaves the backend stopped", () => {
    const result = deploy({ MIGRATE: "unknown" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("outcome could not be read");
    expect(result.log).not.toContain("revert");
    expect(result.running).toBe("");
  });
});

test("deploy_backend.sh quits without touching the release when it can't take the lock", () => {
  setDb("pending");
  const result = deploy({ LOCK: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.log).toEqual(["flock"]);
  expect(result).toMatchObject({
    running: "old",
    release: "old",
    db: "pending",
  });
});
