import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withSecretsFixture } from "./lib/with-secrets-fixture";

// BACKCOMPAT(ALL-1964): delete this file with the fallback block in
// with-secrets.sh.
const fx = withSecretsFixture();

test("refuses a fallback flag other than 1", () => {
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "yes" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("ALLIANCE_SECRETS_ENV_FALLBACK is yes");
  expect(log).toBe("");
});

test("the fallback flag skips AWS and loads and prints each key it falls back on", () => {
  writeFileSync(
    join(fx.repo, "server.env"),
    'ONE=local\nTWO="two words" # note\nOTHER=x\n',
  );
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1", AWS_ACCESS_KEY_ID: "static" },
  });
  expect(exitCode).toBe(0);
  expect(log).not.toContain("aws ssm");
  expect(log).toContain("ONE=local TWO=two words");
  expect(stderr).toContain("using ONE from server.env");
  expect(stderr).toContain("using TWO from server.env");
  expect(stderr).not.toContain("OTHER");
  expect(stderr).not.toContain("local");
});

test("the fallback flag names the file Bun takes each key from", () => {
  fx.loadingEnvFile();
  writeFileSync(join(fx.repo, "server.env"), "ONE=a\n");
  writeFileSync(join(fx.repo, "server.env.development"), "TWO=d\n");
  writeFileSync(join(fx.repo, "server.env.local"), "TWO=b\n");
  writeFileSync(join(fx.repo, "server.env.development.local"), "ONE=c\n");
  const { exitCode, stderr } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(0);
  expect(stderr).toContain("using ONE from server.env.development.local");
  expect(stderr).toContain("using TWO from server.env.local");
});

test("the fallback flag names no key the shell already sets", () => {
  fx.loadingEnvFile();
  writeFileSync(join(fx.repo, "server.env"), "ONE=local\nTWO=local\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1", ONE: "shell" },
  });
  expect(exitCode).toBe(0);
  expect(log).toContain("ONE=shell");
  expect(stderr).not.toContain("using ONE");
  expect(stderr).toContain("using TWO from server.env");
});

test.each([
  ["abc#def", "abc#def"],
  ["abc #def", "abc"],
  ["'a # b' # note", "a # b"],
  ['"it\'s" #x', "it's"],
  ["a\\ #b", "a #b"],
  ["#all", "#all"],
  ['"a\\$b"', "a$b"],
])("the fallback flag reads %s as bash would", (value, expected) => {
  const out = join(fx.dir, "value");
  writeFileSync(join(fx.repo, "server.env"), `ONE=${value}\nTWO=2\n`);
  const { exitCode } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
    args: ["server", "bash", "-c", `printf %s "$ONE" > "${out}"`],
  });
  expect(exitCode).toBe(0);
  expect(readFileSync(out, "utf8")).toBe(expected);
});

test.each([
  // bash 5.3 reports only line 1; earlier versions add line 3's end of file.
  ["ONE='unterminated\nTWO=x\n", "unterminated", "1(, 3)?"],
  ["ONE=x\nsecret-value\nTWO=y\n", "secret-value", 2],
])(
  "the fallback flag fails on an env file bash cannot source, naming the line without quoting it",
  (contents, value, line) => {
    writeFileSync(join(fx.repo, "server.env"), contents);
    const { exitCode, stderr, log } = fx.run({
      env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
    });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(
      new RegExp(`bash cannot source server\\.env at line ${line};`),
    );
    expect(stderr).not.toContain(value);
    expect(log).toBe("");
  },
);

test("the fallback flag only names the keys of a consumer that loads its own env file", () => {
  fx.loadingEnvFile();
  writeFileSync(join(fx.repo, "server.env"), "ONE=a\\b\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(0);
  expect(log).toContain("ONE=unset");
  expect(stderr).toContain("using ONE from server.env");
});

test("the fallback flag fails when the env file lacks a listed key", () => {
  writeFileSync(join(fx.repo, "server.env"), "ONE=local\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("server.env is missing TWO");
  expect(log).toBe("");
});

test("the fallback flag fails on a key the env file leaves empty", () => {
  writeFileSync(join(fx.repo, "server.env"), "ONE=1\nTWO=\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("server.env is missing TWO");
  expect(log).toBe("");
});

test("the fallback flag leaves a listed key the shell already sets", () => {
  writeFileSync(join(fx.repo, "server.env"), "ONE=file\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1", ONE: "shell", TWO: "shell2" },
  });
  expect(exitCode).toBe(0);
  expect(log).toContain("ONE=shell TWO=shell2");
  expect(stderr).not.toContain("using ONE");
});

test("the fallback flag reads a listed key the shell leaves empty from the env file", () => {
  writeFileSync(join(fx.repo, "server.env"), "ONE=1\nTWO=2\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1", ONE: "" },
  });
  expect(exitCode).toBe(0);
  expect(log).toContain("ONE=1 TWO=2");
  expect(stderr).toContain("using ONE from server.env");
});

test("the fallback flag reads on past a command that fails, as a bare source does", () => {
  writeFileSync(
    join(fx.repo, "server.env"),
    "ONE=1\nfalse\nTWO=2\n[ -f nowhere ] && X=1\n",
  );
  const { exitCode, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(0);
  expect(log).toContain("ONE=1 TWO=2");
});

test("the fallback flag fails on a key the env file unsets", () => {
  writeFileSync(join(fx.repo, "server.env"), "ONE=1\nTWO=2\nunset TWO\n");
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("server.env is missing TWO");
  expect(log).toBe("");
});

test("the fallback flag fails when the env file is absent", () => {
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("server.env does not exist");
  expect(log).toBe("");
});
