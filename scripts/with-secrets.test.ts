import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TRICKY = "line one\nline 'two' \"$HOME\" `x` =;\n";

let dir: string;
let repo: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "with-secrets-"));
  repo = join(dir, "repo");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  cpSync(
    join(import.meta.dir, "with-secrets.sh"),
    join(repo, "scripts/with-secrets.sh"),
  );
  writeFileSync(
    join(repo, "scripts/dev-secrets.json"),
    JSON.stringify({
      server: { envFile: "server.env", secrets: ["ONE", "TWO"] },
    }),
  );
  writeFileSync(
    join(dir, "aws"),
    `#!/usr/bin/env bash
echo "aws $* profile=$AWS_PROFILE" >> "$LOG"
if [ -n "\${AWS_STDERR:-}" ]; then echo "$AWS_STDERR" >&2; exit 254; fi
cat "$RESPONSE"
`,
  );
  writeFileSync(
    join(dir, "app"),
    `#!/usr/bin/env bash
printf 'app %s ONE=%s TWO=%s PROFILE=%s MARKER=%s\\n' "$*" "\${ONE-unset}" "\${TWO-unset}" "\${AWS_PROFILE-unset}" "\${ALLIANCE_SECRETS_LOADED-unset}" >> "$LOG"
`,
  );
  chmodSync(join(dir, "aws"), 0o755);
  chmodSync(join(dir, "app"), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

const ONE_AND_TWO = [
  { Name: "/alliance/dev/server/ONE", Value: "1" },
  { Name: "/alliance/dev/server/TWO", Value: "2" },
];

function run(params: {
  env?: Record<string, string>;
  parameters?: { Name: string; Value: string }[];
  args?: string[];
}) {
  const {
    env = {},
    parameters = ONE_AND_TWO,
    args = ["server", "app", "x"],
  } = params;
  const log = join(dir, "log");
  const response = join(dir, "response.json");
  writeFileSync(response, JSON.stringify({ Parameters: parameters }));
  const result = Bun.spawnSync(
    ["bash", join(repo, "scripts/with-secrets.sh"), ...args],
    {
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        LOG: log,
        RESPONSE: response,
        ...env,
      },
    },
  );
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    log: existsSync(log) ? readFileSync(log, "utf8") : "",
  };
}

test("runs the command with the consumer's parameters under the dev profile", () => {
  const { exitCode, log } = run({});
  expect(exitCode).toBe(0);
  expect(log).toContain(
    "aws ssm get-parameters-by-path --region us-west-2 --path /alliance/dev/server/ --with-decryption --output json profile=alliance-dev",
  );
  expect(log).toContain("app x ONE=1 TWO=2 PROFILE=alliance-dev MARKER=server");
});

test("passes any character in a value through intact", () => {
  const out = join(dir, "value");
  const { exitCode } = run({
    parameters: [
      { Name: "/alliance/dev/server/ONE", Value: TRICKY },
      { Name: "/alliance/dev/server/TWO", Value: "2" },
    ],
    args: ["server", "bash", "-c", `printf %s "$ONE" > "${out}"`],
  });
  expect(exitCode).toBe(0);
  expect(readFileSync(out, "utf8")).toBe(TRICKY);
});

test("does not run the command when a listed secret is missing", () => {
  const { exitCode, stderr, log } = run({ parameters: [ONE_AND_TWO[0]] });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("/alliance/dev/server/ is missing TWO");
  expect(log).not.toContain("app x");
});

test("runs the command without a stored key the manifest does not list, naming it", () => {
  const out = join(dir, "db-name");
  const { exitCode, stderr } = run({
    parameters: [
      ...ONE_AND_TWO,
      { Name: "/alliance/dev/server/DB_NAME", Value: "alliance" },
    ],
    args: ["server", "bash", "-c", `printf %s "\${DB_NAME-unset}" > "${out}"`],
  });
  expect(exitCode).toBe(0);
  expect(stderr).toContain("ignoring DB_NAME");
  expect(readFileSync(out, "utf8")).toBe("unset");
});

test("refuses to override a variable that is already set, naming it", () => {
  const { exitCode, stderr, log } = run({ env: { TWO: "from-shell" } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("TWO already set");
  expect(log).toBe("");
});

test("a nested run for the same consumer leaves the environment alone", () => {
  const { exitCode, log } = run({
    env: { ALLIANCE_SECRETS_LOADED: "server", ONE: "kept" },
  });
  expect(exitCode).toBe(0);
  expect(log).not.toContain("aws ssm");
  expect(log).toContain("ONE=kept");
});

test("a nested run names a command that does not exist", () => {
  const { exitCode, stderr } = run({
    env: { ALLIANCE_SECRETS_LOADED: "server" },
    args: ["server", "no-such-command"],
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("command not found: no-such-command");
});

test("a nested run names a command it cannot execute", () => {
  const notes = join(dir, "notes.txt");
  writeFileSync(notes, "");
  const { exitCode, stderr } = run({
    env: { ALLIANCE_SECRETS_LOADED: "server" },
    args: ["server", notes],
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(`cannot run ${notes}: Permission denied`);
});

test.each([
  ["AWS_ACCESS_KEY_ID"],
  ["AWS_SECRET_ACCESS_KEY"],
  ["AWS_SESSION_TOKEN"],
])("refuses static AWS credentials in %s", (name) => {
  const { exitCode, stderr, log } = run({ env: { [name]: "static" } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(`unset ${name}`);
  expect(log).toBe("");
});

test.each([
  ["export AWS_ACCESS_KEY_ID=static"],
  ["AWS_ACCESS_KEY_ID = static"],
])("refuses static AWS credentials in the consumer's env file: %s", (line) => {
  writeFileSync(join(repo, "server.env"), `${line}\n`);
  const { exitCode, stderr, log } = run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain("remove AWS_ACCESS_KEY_ID from server.env");
  expect(log).toBe("");
});

test.each([
  ["server.env.local"],
  ["server.env.development"],
  ["server.env.development.local"],
])("refuses static AWS credentials in %s, which Bun also loads", (name) => {
  writeFileSync(join(repo, name), "AWS_SECRET_ACCESS_KEY=static\n");
  const { exitCode, stderr, log } = run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain(`remove AWS_SECRET_ACCESS_KEY from ${name}`);
  expect(log).toBe("");
});

test("refuses a different AWS profile", () => {
  const { exitCode, stderr, log } = run({ env: { AWS_PROFILE: "other" } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("AWS_PROFILE is other");
  expect(log).toBe("");
});

test("accepts AWS_PROFILE already set to alliance-dev", () => {
  const { exitCode, log } = run({ env: { AWS_PROFILE: "alliance-dev" } });
  expect(exitCode).toBe(0);
  expect(log).toContain("PROFILE=alliance-dev");
});

test("points at the setup doc when the aws CLI is not installed", () => {
  const bin = join(dir, "bin");
  mkdirSync(bin);
  for (const name of ["bash", "dirname", "python3"])
    symlinkSync(Bun.which(name) ?? name, join(bin, name));
  const { exitCode, stderr, log } = run({ env: { PATH: bin } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "the aws CLI is not installed; see docs/local-secrets.md",
  );
  expect(log).toBe("");
});

test("names the path it could not read on an unrecognized aws error", () => {
  const { exitCode, stderr, log } = run({
    env: { AWS_STDERR: "Unable to locate credentials" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "could not read /alliance/dev/server/ from Parameter Store",
  );
  expect(stderr).toContain("Unable to locate credentials");
  expect(log).not.toContain("app x");
});

test("names the login command on an expired login", () => {
  const { exitCode, stderr, log } = run({
    env: {
      AWS_STDERR:
        "Error when retrieving token from sso: Token has expired and refresh failed",
    },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("run: aws sso login --profile alliance-dev");
  expect(log).not.toContain("app x");
});

test("names the login command on a revoked login", () => {
  const { exitCode, stderr } = run({
    env: {
      AWS_STDERR:
        "An error occurred (UnauthorizedException) when calling the GetRoleCredentials operation: Session token not found or invalid",
    },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("run: aws sso login --profile alliance-dev");
});

test("reports a denied read as missing access, not an expired login", () => {
  const { exitCode, stderr, log } = run({
    env: {
      AWS_STDERR:
        "An error occurred (AccessDeniedException) when calling the GetParametersByPath operation: User: arn:aws:sts::123456789012:assumed-role/AWSReservedSSO_alliance-dev_0123/someone is not authorized to perform: ssm:GetParametersByPath",
    },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "ask an admin to check your alliance-dev assignment",
  );
  expect(stderr).not.toContain("expired");
  expect(log).not.toContain("app x");
});

test("reports an unassigned login as missing access", () => {
  const { exitCode, stderr } = run({
    env: {
      AWS_STDERR:
        "An error occurred (ForbiddenException) when calling the GetRoleCredentials operation: No access",
    },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "ask an admin to check your alliance-dev assignment",
  );
});

test("points at the setup doc when the profile does not exist", () => {
  const { exitCode, stderr } = run({
    env: { AWS_STDERR: "The config profile (alliance-dev) could not be found" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("docs/local-secrets.md");
});

test("refuses a fallback flag other than 1", () => {
  const { exitCode, stderr, log } = run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "yes" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("ALLIANCE_SECRETS_ENV_FALLBACK is yes");
  expect(log).toBe("");
});

test("the fallback flag skips AWS and names each key it falls back on", () => {
  writeFileSync(join(repo, "server.env"), "ONE=local\nOTHER=x\n");
  const { exitCode, stderr, log } = run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1", AWS_ACCESS_KEY_ID: "static" },
  });
  expect(exitCode).toBe(0);
  expect(log).not.toContain("aws ssm");
  expect(log).toContain("ONE=unset TWO=unset");
  expect(stderr).toContain("using ONE from server.env");
  expect(stderr).not.toContain("TWO");
  expect(stderr).not.toContain("OTHER");
  expect(stderr).not.toContain("local");
});

test("the fallback flag names the file Bun takes each key from", () => {
  writeFileSync(join(repo, "server.env"), "ONE=a\n");
  writeFileSync(join(repo, "server.env.development"), "TWO=d\n");
  writeFileSync(join(repo, "server.env.local"), "TWO=b\n");
  writeFileSync(join(repo, "server.env.development.local"), "ONE=c\n");
  const { exitCode, stderr } = run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(0);
  expect(stderr).toContain("using ONE from server.env.development.local");
  expect(stderr).toContain("using TWO from server.env.local");
});

test("the fallback flag names no key the shell already sets", () => {
  writeFileSync(join(repo, "server.env"), "ONE=local\nTWO=local\n");
  const { exitCode, stderr, log } = run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1", ONE: "shell" },
  });
  expect(exitCode).toBe(0);
  expect(log).toContain("ONE=shell");
  expect(stderr).not.toContain("using ONE");
  expect(stderr).toContain("using TWO from server.env");
});

test("the fallback flag fails when the env file is absent", () => {
  const { exitCode, stderr, log } = run({
    env: { ALLIANCE_SECRETS_ENV_FALLBACK: "1" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("server.env does not exist");
  expect(log).toBe("");
});

test("rejects an unknown consumer", () => {
  const { exitCode, stderr } = run({ args: ["nope", "app"] });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unknown consumer nope; expected one of server\n");
});

test("needs a consumer and a command", () => {
  expect(run({ args: ["server"] }).exitCode).toBe(2);
});
