import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "secrets_run.sh");
const TRICKY = "line one\nline 'two' \"$HOME\" `x` =;\n";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "secrets-run-"));
  writeFileSync(
    join(dir, "aws"),
    `#!/usr/bin/env bash
echo "aws $*" >> "$LOG"
[ "\${AWS_FAIL:-}" = 1 ] && { echo "AccessDeniedException" >&2; exit 254; }
cat "$RESPONSE"
`,
  );
  writeFileSync(
    join(dir, "backend"),
    `#!/usr/bin/env bash
printf 'backend %s DB_PASSWORD=%s JWT_SECRET=%s\\n' "$*" "\${DB_PASSWORD-unset}" "\${JWT_SECRET-unset}" >> "$LOG"
`,
  );
  chmodSync(join(dir, "aws"), 0o755);
  chmodSync(join(dir, "backend"), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

function run(
  env: Record<string, string>,
  parameters: { Name: string; Value: string }[] = [],
  command = ["backend", "src/main.ts"],
) {
  const log = join(dir, "log");
  const response = join(dir, "response.json");
  writeFileSync(response, JSON.stringify({ Parameters: parameters }));
  const result = Bun.spawnSync(["bash", SCRIPT, ...command], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      LOG: log,
      RESPONSE: response,
      ...env,
    },
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    log: existsSync(log) ? readFileSync(log, "utf8") : "",
  };
}

test.each([
  ["staging", "staging"],
  ["production", "prod"],
])(
  "NODE_ENV=%s runs the command with /alliance/%s/server/'s parameters",
  (nodeEnv, envName) => {
    const prefix = `/alliance/${envName}/server/`;
    const { exitCode, log } = run({ NODE_ENV: nodeEnv }, [
      { Name: `${prefix}DB_PASSWORD`, Value: TRICKY },
      { Name: `${prefix}JWT_SECRET`, Value: "jwt" },
    ]);
    expect(exitCode).toBe(0);
    expect(log).toBe(
      `aws ssm get-parameters-by-path --region us-west-2 --path ${prefix} --with-decryption --output json\n` +
        `backend src/main.ts DB_PASSWORD=${TRICKY} JWT_SECRET=jwt\n`,
    );
  },
);

test.each<Record<string, string>>([{}, { NODE_ENV: "development" }])(
  "refuses %p without calling AWS",
  (env) => {
    const { exitCode, log } = run(env);
    expect(exitCode).toBe(1);
    expect(log).toBe("");
  },
);

test("a failed fetch runs nothing", () => {
  const { exitCode, log, stderr } = run({ NODE_ENV: "staging", AWS_FAIL: "1" });
  expect(exitCode).not.toBe(0);
  expect(log).not.toContain("backend");
  expect(stderr).toContain("could not read /alliance/staging/server/");
});

test("an empty path runs nothing", () => {
  const { exitCode, log, stderr } = run({ NODE_ENV: "staging" });
  expect(exitCode).not.toBe(0);
  expect(log).not.toContain("backend");
  expect(stderr).toContain("no parameters under /alliance/staging/server/");
});

test("a parameter that isn't an env var name runs nothing", () => {
  const { exitCode, log, stderr } = run({ NODE_ENV: "staging" }, [
    { Name: "/alliance/staging/server/db-password", Value: "x" },
  ]);
  expect(exitCode).not.toBe(0);
  expect(log).not.toContain("backend");
  expect(stderr).toContain("is not an env var name");
});

test("a parameter named like a variable already set runs nothing", () => {
  const { exitCode, log, stderr } = run(
    { NODE_ENV: "staging", DB_PASSWORD: "from-env" },
    [{ Name: "/alliance/staging/server/DB_PASSWORD", Value: "x" }],
  );
  expect(exitCode).not.toBe(0);
  expect(log).not.toContain("backend");
  expect(stderr).toContain(
    "/alliance/staging/server/DB_PASSWORD would override DB_PASSWORD",
  );
});

test("no command calls nothing", () => {
  const { exitCode, log, stderr } = run({ NODE_ENV: "staging" }, [], []);
  expect(exitCode).toBe(2);
  expect(log).toBe("");
  expect(stderr).toContain("usage: secrets_run.sh");
});
