import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SQL = readFileSync(
  join(import.meta.dir, "disable_action_update_texts_emails.sql"),
  "utf8",
);

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "db-over-ssh-"));
  writeFileSync(
    join(dir, "ssh"),
    `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$STATE/args"
cat > "$STATE/stdin"
echo dump-bytes`,
  );
  chmodSync(join(dir, "ssh"), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

function run(script: string, args: string[] = []) {
  const result = Bun.spawnSync(
    ["bash", join(import.meta.dir, script), ...args],
    {
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        STATE: dir,
        DUMP_DIR: join(dir, "dumps"),
      },
      stdin: "ignore",
    },
  );
  const read = (name: string) => readFileSync(join(dir, name), "utf8");
  return {
    exitCode: result.exitCode,
    args: read("args"),
    stdin: read("stdin"),
  };
}

test.each([
  [[], "staging", "staging", "false"],
  [["prod"], "prod", "production", "false"],
  [["prod", "--apply"], "prod", "production", "true"],
])(
  "disable_action_update_texts_emails.sh %p runs psql through with_db_env.sh",
  (args, host, environment, apply) => {
    const result = run("disable_action_update_texts_emails.sh", args);
    expect(result.exitCode).toBe(0);
    expect(result.args).toBe(
      `${host}\nbash nest-backend/scripts/with_db_env.sh ${environment} psql -X -v apply=${apply}\n`,
    );
    expect(result.stdin).toBe(SQL);
  },
);

test("disable_action_update_texts_emails.sh refuses any other target before SSHing", () => {
  const result = Bun.spawnSync(
    [
      "bash",
      join(import.meta.dir, "disable_action_update_texts_emails.sh"),
      "staging2",
    ],
    {
      env: { PATH: `${dir}:${process.env.PATH}`, STATE: dir },
      stdin: "ignore",
    },
  );
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("target must be staging or prod");
  expect(existsSync(join(dir, "args"))).toBe(false);
});

test("download_staging_data.sh saves pg_dump's output from with_db_env.sh", () => {
  const result = run("download_staging_data.sh");
  expect(result.exitCode).toBe(0);
  expect(result.args).toBe(
    "staging\nbash nest-backend/scripts/with_db_env.sh staging pg_dump --format=custom --no-owner --no-privileges\n",
  );
  const [dump] = readdirSync(join(dir, "dumps"));
  expect(readFileSync(join(dir, "dumps", dump), "utf8")).toBe("dump-bytes\n");
});
