import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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

const SCRIPT = join(import.meta.dir, "deploy_backend.sh");
const BACKUP_NOTE =
  "The old release is in ~/nest-backend-deploy-backup, which the next deploy replaces.";

// Each stub logs what it was asked to do. The database is one word in
// state/db, the running release one word in state/pm2 and its pid in state/pid,
// and a release is the word in its directory's `release` file.
const STUBS: Record<string, string> = {
  flock: `
    echo flock >> "$STATE/log"
    [ "\${LOCK:-ok}" = ok ]`,
  sleep: "exit 0",
  unzip: `
    dir="\${@: -1}"
    mkdir -p "$dir/server"
    echo new > "$dir/release"
    echo unzip >> "$STATE/log"
    [ "\${UNZIP:-ok}" = ok ]`,
  bun: `
    case "$1 \${2:-}" in
      "install --frozen-lockfile")
        echo install >> "$STATE/log"
        [ -z "\${AUTORESTART:-}" ] || { echo new > "$STATE/pm2"; echo 101 > "$STATE/pid"; }
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
        echo "$release" > "$STATE/pm2"
        echo $(( $(cat "$STATE/pid") + 1 )) > "$STATE/pid";;
      restart)
        release=$(cat "$HOME/nest-backend/release")
        echo "restart $release" >> "$STATE/log"
        [ "\${RESTART:-ok}" = ok ] || exit 1
        echo "$release" > "$STATE/pm2"
        echo $(( $(cat "$STATE/pid") + 1 )) > "$STATE/pid";;
      pid)
        [ "\${PID:-ok}" = ok ] || exit 1
        [ "\${LATE_PID:-ok}" = ok ] || ! grep -qx install "$STATE/log" || exit 1
        [ ! -e "$STATE/cold" ] || { rm "$STATE/cold"; echo "[PM2] Spawning PM2 daemon"; echo "[PM2] PM2 Successfully daemonized"; }
        cat "$STATE/pid";;
      jlist)
        if [ -n "$(cat "$STATE/pm2")" ]; then echo '[{"name":"nest-app"}]'; else echo '[]'; fi;;
      save) ;;
      *) echo "unexpected pm2 $*" >&2; exit 2;;
    esac`,
  mv: `
    [ "$1" != nest-backend-deploy-backup ] || [ "\${PUT_BACK:-ok}" = ok ] || exit 1
    exec /bin/mv "$@"`,
  rm: `
    [ "$2" != nest-backend ] || [ "\${REMOVE:-ok}" = ok ] || exit 1
    exec /bin/rm "$@"`,
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
  writeFileSync(join(state, "pid"), "100\n");
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
  const read = (file: string) => readFileSync(file, "utf8").trim();
  const releaseFile = join(home, "nest-backend", "release");
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
    log: read(join(state, "log")).split("\n"),
    running: read(join(state, "pm2")),
    db: read(join(state, "db")),
    release: existsSync(releaseFile) ? read(releaseFile) : "",
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

    test("a failed install leaves the old backend running, unmigrated", () => {
      const result = deploy({ INSTALL: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.log).toEqual(["flock", "unzip", "install"]);
      expect(result).toMatchObject({ running: "old", release: "old" });
    });

    test("a failed migration leaves the old backend running", () => {
      const result = deploy({ MIGRATE: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.log).toEqual([
        "flock",
        "unzip",
        "install",
        "migrate while running: old",
      ]);
      expect(result.output).toContain("The old backend is still running.");
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

    test("a failed health check with a new release that can't be removed says the backend is left stopped", () => {
      const result = deploy({ HEALTH: "fail", REMOVE: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("The backend is left stopped");
      expect(result.output).toContain(BACKUP_NOTE);
      expect(result.running).toBe("");
    });

    test("a failed health check with an old release that won't restart says the backend is left stopped", () => {
      const result = deploy({ HEALTH: "fail", START_OLD: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("The backend is left stopped");
      expect(result.running).toBe("");
    });

    test("a failed health check with a new backend that can't be stopped or removed says so", () => {
      const result = deploy({ HEALTH: "fail", STOP: "fail", REMOVE: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("the new backend could not be stopped");
      expect(result.output).toContain(BACKUP_NOTE);
      expect(result.output).not.toContain("left stopped");
      expect(result.running).toBe("new");
    });
  },
);

test("deploy_backend.sh leaves the old backend running on an unreadable removal state", () => {
  setDb("pending");
  writeFileSync(join(state, "unreadable"), "");
  const result = deploy();
  expect(result.exitCode).toBe(1);
  expect(result.log).toEqual(["flock", "unzip", "install"]);
  expect(result).toMatchObject({
    running: "old",
    release: "old",
    db: "pending",
  });
});

test("deploy_backend.sh leaves the old backend running on an unrecognized removal state", () => {
  setDb("pending");
  writeFileSync(join(state, "slow"), "");
  const result = deploy();
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    "::error::Unexpected streak recognition removal state. The old backend is still running.",
  );
  expect(result.log).toEqual(["flock", "unzip", "install"]);
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
    expect(result.log).toEqual(["flock", "unzip", "install"]);
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
    expect(result.output).not.toContain(BACKUP_NOTE);
    expect(result).toMatchObject({ running: "", db: "pending" });
  });

  test.each(["REMOVE", "PUT_BACK"])(
    "an old release that can't be put back after the guard fails says the backend is left stopped (%s fails)",
    (name) => {
      const result = deploy({ MIGRATE: "guard", [name]: "fail" });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("The backend is left stopped");
      expect(result.output).toContain(BACKUP_NOTE);
      expect(result.log.filter((line) => line.startsWith("start"))).toEqual([]);
    },
  );

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

test("deploy_backend.sh leaves the old backend running when unzipping fails", () => {
  setDb("pending");
  const result = deploy({ UNZIP: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("The old backend is still running.");
  expect(result.log).toEqual(["flock", "unzip"]);
  expect(result).toMatchObject({ running: "old", release: "old" });
});

test("deploy_backend.sh says so when a preparation failure can't put the old release back", () => {
  setDb("pending");
  const result = deploy({ INSTALL: "fail", REMOVE: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    `The previous release could not be put back. ${BACKUP_NOTE}`,
  );
  expect(result.log).toEqual(["flock", "unzip", "install"]);
});

test("deploy_backend.sh says so when a first deploy fails with no release to put back", () => {
  setDb("pending");
  rmSync(join(home, "nest-backend"), { recursive: true });
  const result = deploy({ INSTALL: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("There was no previous release to put back.");
  expect(result.output).not.toContain("still running");
  expect(result.log).toEqual(["flock", "unzip", "install"]);
});

test.each([false, true])(
  "deploy_backend.sh starts nothing when no backend was running before the deploy (pm2 daemon spawned: %p)",
  (cold) => {
    setDb("pending");
    writeFileSync(join(state, "pm2"), "");
    writeFileSync(join(state, "pid"), "");
    if (cold) writeFileSync(join(state, "cold"), "");
    const result = deploy({ INSTALL: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "pm2 reported no running backend as the deploy began or since",
    );
    expect(result.output).not.toContain("still running");
    expect(result.log).not.toContain("restart old");
    expect(result).toMatchObject({ running: "", release: "old" });
  },
);

test.each(["100", ""])(
  "deploy_backend.sh restarts the old backend when pm2 brought it back on the new release (pid at start: %p)",
  (pid) => {
    setDb("pending");
    writeFileSync(join(state, "pid"), `${pid}\n`);
    const result = deploy({ AUTORESTART: "1", INSTALL: "fail" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("restarted again from the old release.");
    expect(result.log).toEqual(["flock", "unzip", "install", "restart old"]);
    expect(result).toMatchObject({ running: "old", release: "old" });
  },
);

test("deploy_backend.sh says so when it can't restart an old backend pm2 brought back", () => {
  setDb("pending");
  const result = deploy({ AUTORESTART: "1", INSTALL: "fail", RESTART: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    "could not be restarted from the old release.",
  );
  expect(result.output).not.toContain("still running");
});

test("deploy_backend.sh restarts nothing when pm2 can't report the pid after a preparation failure", () => {
  setDb("pending");
  const result = deploy({ INSTALL: "fail", LATE_PID: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    "pm2 could not report whether the old backend is still running; check it by hand.",
  );
  expect(result.log).toEqual(["flock", "unzip", "install"]);
  expect(result).toMatchObject({ running: "old", release: "old" });
});

test("deploy_backend.sh quits without touching the release when pm2 can't report the backend's pid", () => {
  setDb("pending");
  const result = deploy({ PID: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("Could not read the backend's pid from pm2");
  expect(result.log).toEqual(["flock"]);
  expect(result).toMatchObject({ running: "old", release: "old" });
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
