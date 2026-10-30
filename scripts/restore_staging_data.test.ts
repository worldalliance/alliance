import { afterEach, beforeEach, expect, test } from "bun:test";
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

const SCRIPT = join(import.meta.dir, "restore_staging_data.sh");

const STUBS: Record<string, string> = {
  pg_restore: `
    echo pg_restore >> "$STATE/log"
    exit "\${RESTORE_STATUS:-0}"`,
  psql: `
    echo "psql \${@: -1}" >> "$STATE/log"
    cat >> "$STATE/stdin"
    exit "\${CLEAR_STATUS:-0}"`,
};

let home: string;
let bin: string;
let state: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "restore-staging-"));
  bin = join(home, "bin");
  state = join(home, "state");
  mkdirSync(bin);
  mkdirSync(state);
  writeFileSync(join(home, "dump.pgcustom"), "");
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
});

afterEach(() => {
  rmSync(home, { recursive: true });
});

function restore(params: {
  restoreStatus: number;
  clearStatus: number;
  reset?: boolean;
}) {
  const result = Bun.spawnSync(["bash", SCRIPT, join(home, "dump.pgcustom")], {
    stdin: "ignore",
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      STATE: state,
      LOCAL_DB_NAME: "restore_test",
      RESET_LOCAL_DB: params.reset ? "1" : "0",
      RESTORE_STATUS: String(params.restoreStatus),
      CLEAR_STATUS: String(params.clearStatus),
    },
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    log: readFileSync(join(state, "log"), "utf8").trim().split("\n"),
    stdin: readFileSync(join(state, "stdin"), "utf8"),
  };
}

const CLEAR = 'psql UPDATE "user_device" SET "expoPushToken" = NULL;';

test("restore_staging_data.sh clears push tokens after a restore", () => {
  expect(restore({ restoreStatus: 0, clearStatus: 0 })).toMatchObject({
    exitCode: 0,
    log: ["pg_restore", CLEAR],
  });
});

test("restore_staging_data.sh recreates the database with its comment before restoring", () => {
  const result = restore({ restoreStatus: 0, clearStatus: 0, reset: true });
  expect(result).toMatchObject({
    exitCode: 0,
    log: ["psql db=restore_test", "pg_restore", CLEAR],
  });
  expect(result.stdin).toMatch(
    /SELECT coalesce\(\(SELECT shobj_description[^\n]*\), ''\) AS comment \\gset\nDROP DATABASE [^\n]*\nCREATE DATABASE :"db";\nCOMMENT ON DATABASE :"db" IS :'comment';\n/,
  );
});

test("restore_staging_data.sh clears push tokens after a partly failed restore, then fails", () => {
  expect(restore({ restoreStatus: 1, clearStatus: 0 })).toMatchObject({
    exitCode: 1,
    log: ["pg_restore", CLEAR],
  });
});

test("restore_staging_data.sh reports a failed restore over the failed clear that follows it", () => {
  const result = restore({ restoreStatus: 2, clearStatus: 3 });
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain(
    "pg_restore exited 2, and push tokens could not be cleared",
  );
});

test("restore_staging_data.sh fails when the clear fails after a restore", () => {
  expect(restore({ restoreStatus: 0, clearStatus: 3 }).exitCode).toBe(3);
});
