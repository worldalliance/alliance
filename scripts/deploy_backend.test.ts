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

// Each stub logs what it was asked to do. The running release is one word in
// state/pm2, and a release is the word in its directory's `release` file.
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
      *) echo "unexpected bun $*" >&2; exit 2;;
    esac`,
  bunx: `
    echo "migrate while running: $(cat "$STATE/pm2")" >> "$STATE/log"
    [ "\${MIGRATE:-ok}" = ok ]`,
  pm2: `
    if { : >&9; } 2>/dev/null; then echo "pm2 inherited the lock fd" >&2; exit 3; fi
    case "$1" in
      delete)
        echo "delete $(cat "$STATE/pm2")" >> "$STATE/log"
        [ -n "$(cat "$STATE/pm2")" ] || exit 1
        : > "$STATE/pm2";;
      start)
        release=$(cat ../release)
        echo "start $release" >> "$STATE/log"
        echo "$release" > "$STATE/pm2";;
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
    release: readFileSync(join(home, "nest-backend", "release"), "utf8").trim(),
  };
}

describe("deploy_backend.sh", () => {
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
    expect(result.log.slice(-2)).toEqual(["delete new", "start old"]);
    expect(result).toMatchObject({ running: "old", release: "old" });
  });
});

test("deploy_backend.sh quits without touching the release when it can't take the lock", () => {
  const result = deploy({ LOCK: "fail" });
  expect(result.exitCode).toBe(1);
  expect(result.log).toEqual(["flock"]);
  expect(result).toMatchObject({ running: "old", release: "old" });
});
