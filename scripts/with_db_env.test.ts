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

const SOURCE = join(import.meta.dir, "with_db_env.sh");

let home: string;
let script: string;

function executable(path: string, body: string) {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "with-db-env-"));
  mkdirSync(join(home, ".bun/bin"), { recursive: true });
  mkdirSync(join(home, "nest-backend/scripts"), { recursive: true });
  script = join(home, "nest-backend/scripts/with_db_env.sh");
  executable(
    script,
    readFileSync(SOURCE, "utf8").replaceAll("/home/ec2-user", home),
  );
  executable(
    join(home, ".bun/bin/bun"),
    `[ -z "\${BUN_FAILS:-}" ] && [ "$1" = "${home}/nest-backend/scripts/deployed-db-name.ts" ] && echo "db-$2"`,
  );
  executable(
    join(home, "secrets_run.sh"),
    `echo SECRETS_RUN_REACHED >&2
    [ "$1 $3 $4 $5 $6" = "--path DB_HOST DB_USERNAME DB_PASSWORD --" ] || exit 9
    store=\${2#/alliance/}
    DB_HOST="\${store%/server/}.invalid" DB_USERNAME=admin DB_PASSWORD="it's \\$ecret" exec "\${@:7}"`,
  );
});

afterEach(() => {
  rmSync(home, { recursive: true });
});

const run = (args: string[], env: Record<string, string> = {}) =>
  Bun.spawnSync(["bash", script, ...args], {
    env: { PATH: process.env.PATH, ...env },
    stderr: "pipe",
  });

test.each([
  ["staging", "staging"],
  ["production", "prod"],
])(
  "%s runs the command with libpq set from /alliance/%s/server/",
  (target, store) => {
    const result = run([
      target,
      "bash",
      "-c",
      'printf "%s|" "$1" "$PGHOST" "$PGUSER" "$PGPASSWORD" "$PGDATABASE" "$PGSSLMODE" "$PGSSLROOTCERT"',
      "_",
      "arg with space",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe(
      `arg with space|${store}.invalid|admin|it's $ecret|db-${target}|verify-full|${home}/nest-backend/server/src/config/rds-us-west-2-bundle.pem|`,
    );
  },
);

test.each([[["dev", "true"]], [["staging"]], [[]]])("refuses %p", (args) => {
  const result = run(args);
  expect(result.exitCode).toBe(2);
  expect(result.stderr.toString()).toContain("usage: with_db_env.sh");
});

test("stops before loading the login when it can't read the database name", () => {
  const result = run(["staging", "true"], { BUN_FAILS: "1" });
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).not.toContain("SECRETS_RUN_REACHED");
});
