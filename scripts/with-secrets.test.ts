import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONE_AND_TWO, withSecretsFixture } from "./lib/with-secrets-fixture";

const fx = withSecretsFixture();

const TRICKY = "line one\nline 'two' \"$HOME\" `x` =;\n";

test("runs the command with the consumer's parameters under the dev profile", () => {
  const { exitCode, log } = fx.run({});
  expect(exitCode).toBe(0);
  expect(log).toContain(
    "aws ssm get-parameters-by-path --region us-west-2 --path /alliance/dev/server/ --with-decryption --output json profile=alliance-dev",
  );
  expect(log).toContain("app x ONE=1 TWO=2 PROFILE=alliance-dev MARKER=server");
});

test("passes any character in a value through intact", () => {
  const out = join(fx.dir, "value");
  const { exitCode } = fx.run({
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
  const { exitCode, stderr, log } = fx.run({ parameters: [ONE_AND_TWO[0]] });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("/alliance/dev/server/ is missing TWO");
  expect(log).not.toContain("app x");
});

test("runs the command without a stored key the manifest does not list, naming it", () => {
  const out = join(fx.dir, "db-name");
  const { exitCode, stderr } = fx.run({
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
  const { exitCode, stderr, log } = fx.run({ env: { TWO: "from-shell" } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("TWO already set");
  expect(log).toBe("");
});

test("a nested run for the same consumer leaves the environment alone", () => {
  const { exitCode, log } = fx.run({
    env: { ALLIANCE_SECRETS_LOADED: "server", ONE: "kept" },
  });
  expect(exitCode).toBe(0);
  expect(log).not.toContain("aws ssm");
  expect(log).toContain("ONE=kept");
});

test("a nested run names a command that does not exist", () => {
  const { exitCode, stderr } = fx.run({
    env: { ALLIANCE_SECRETS_LOADED: "server" },
    args: ["server", "no-such-command"],
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("command not found: no-such-command");
});

test("a nested run names a command it cannot execute", () => {
  const notes = join(fx.dir, "notes.txt");
  writeFileSync(notes, "");
  const { exitCode, stderr } = fx.run({
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
  const { exitCode, stderr, log } = fx.run({ env: { [name]: "static" } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(`unset ${name}`);
  expect(log).toBe("");
});

test.each([
  ["export AWS_ACCESS_KEY_ID=static"],
  ["AWS_ACCESS_KEY_ID = static"],
])("refuses static AWS credentials in the consumer's env file: %s", (line) => {
  fx.loadingEnvFile();
  writeFileSync(join(fx.repo, "server.env"), `${line}\n`);
  const { exitCode, stderr, log } = fx.run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain("remove AWS_ACCESS_KEY_ID from server.env");
  expect(log).toBe("");
});

test.each([
  ["server.env.local"],
  ["server.env.development"],
  ["server.env.development.local"],
])("refuses static AWS credentials in %s, which Bun also loads", (name) => {
  fx.loadingEnvFile();
  writeFileSync(join(fx.repo, name), "AWS_SECRET_ACCESS_KEY=static\n");
  const { exitCode, stderr, log } = fx.run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain(`remove AWS_SECRET_ACCESS_KEY from ${name}`);
  expect(log).toBe("");
});

test("ignores static AWS credentials in an env file nothing loads", () => {
  writeFileSync(join(fx.repo, "server.env"), "AWS_ACCESS_KEY_ID=static\n");
  const { exitCode, log } = fx.run({});
  expect(exitCode).toBe(0);
  expect(log).toContain("aws ssm");
});

test("refuses a different AWS profile", () => {
  const { exitCode, stderr, log } = fx.run({ env: { AWS_PROFILE: "other" } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("AWS_PROFILE is other");
  expect(log).toBe("");
});

test("accepts AWS_PROFILE already set to alliance-dev", () => {
  const { exitCode, log } = fx.run({ env: { AWS_PROFILE: "alliance-dev" } });
  expect(exitCode).toBe(0);
  expect(log).toContain("PROFILE=alliance-dev");
});

test("points at the setup doc when the aws CLI is not installed", () => {
  const bin = join(fx.dir, "bin");
  mkdirSync(bin);
  for (const name of ["bash", "dirname", "python3"])
    symlinkSync(Bun.which(name) ?? name, join(bin, name));
  const { exitCode, stderr, log } = fx.run({ env: { PATH: bin } });
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "the aws CLI is not installed; see docs/local-secrets.md",
  );
  expect(log).toBe("");
});

test("names the path it could not read on an unrecognized aws error", () => {
  const { exitCode, stderr, log } = fx.run({
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
  const { exitCode, stderr, log } = fx.run({
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
  const { exitCode, stderr } = fx.run({
    env: {
      AWS_STDERR:
        "An error occurred (UnauthorizedException) when calling the GetRoleCredentials operation: Session token not found or invalid",
    },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("run: aws sso login --profile alliance-dev");
});

test("reports a denied read as missing access, not an expired login", () => {
  const { exitCode, stderr, log } = fx.run({
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
  const { exitCode, stderr } = fx.run({
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
  const { exitCode, stderr } = fx.run({
    env: { AWS_STDERR: "The config profile (alliance-dev) could not be found" },
  });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("docs/local-secrets.md");
});

test("rejects an unknown consumer", () => {
  const { exitCode, stderr } = fx.run({ args: ["nope", "app"] });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unknown consumer nope; expected one of server\n");
});

test("rejects a consumer whose manifest entry leaves out a field", () => {
  writeFileSync(
    join(fx.repo, "scripts/dev-secrets.json"),
    JSON.stringify({ server: { envFile: "server.env", secrets: ["ONE"] } }),
  );
  const { exitCode, stderr, log } = fx.run({});
  expect(exitCode).toBe(1);
  expect(stderr).toBe(
    "with-secrets.sh: scripts/dev-secrets.json: consumer server lacks loadsEnvFile\n",
  );
  expect(log).toBe("");
});

test("rejects a loadsEnvFile that is not a boolean", () => {
  writeFileSync(
    join(fx.repo, "scripts/dev-secrets.json"),
    JSON.stringify({
      server: {
        envFile: "server.env",
        loadsEnvFile: "false",
        secrets: ["ONE"],
      },
    }),
  );
  const { exitCode, stderr, log } = fx.run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "consumer server loadsEnvFile must be true or false",
  );
  expect(log).toBe("");
});

test("needs a consumer and a command", () => {
  expect(fx.run({ args: ["server"] }).exitCode).toBe(2);
});

test("ALLIANCE_WITHOUT_TEAM_SECRETS in the shell skips Parameter Store, saying so", () => {
  const { exitCode, stderr, log } = fx.run({
    env: { ALLIANCE_WITHOUT_TEAM_SECRETS: "1" },
  });
  expect(exitCode).toBe(0);
  expect(stderr).toContain(
    "ALLIANCE_WITHOUT_TEAM_SECRETS is set, so server runs without the secrets in Parameter Store",
  );
  expect(log).not.toContain("aws ");
  expect(log).toContain("app x ONE=unset TWO=unset PROFILE=unset");
});

test.each([
  ["server.env", "ALLIANCE_WITHOUT_TEAM_SECRETS=true\n"],
  ["server.env.local", 'ALLIANCE_WITHOUT_TEAM_SECRETS="1"\n'],
  ["server.env", "ALLIANCE_WITHOUT_TEAM_SECRETS=1 # contributor\n"],
  ["server.env", "ALLIANCE_WITHOUT_TEAM_SECRETS=`1`\n"],
  ["server.env", "CONTRIBUTOR=1\nALLIANCE_WITHOUT_TEAM_SECRETS=$CONTRIBUTOR\n"],
])(
  "ALLIANCE_WITHOUT_TEAM_SECRETS in %s skips Parameter Store and reaches a consumer that loads it",
  (name, line) => {
    fx.loadingEnvFile();
    writeFileSync(join(fx.repo, name), line);
    const { exitCode, log } = fx.run({});
    expect(exitCode).toBe(0);
    expect(log).not.toContain("aws ");
    expect(log).toMatch(/ FLAG=(1|true)\n/);
  },
);

test("a later env file turning ALLIANCE_WITHOUT_TEAM_SECRETS off wins, as in Bun", () => {
  fx.loadingEnvFile();
  writeFileSync(
    join(fx.repo, "server.env"),
    "ALLIANCE_WITHOUT_TEAM_SECRETS=1\n",
  );
  writeFileSync(
    join(fx.repo, "server.env.local"),
    "ALLIANCE_WITHOUT_TEAM_SECRETS=0\n",
  );
  const { log } = fx.run({});
  expect(log).toContain("aws ssm get-parameters-by-path");
  expect(log).toMatch(/ FLAG=0\n/);
});

test("ALLIANCE_WITHOUT_TEAM_SECRETS in an env file nothing loads is ignored", () => {
  writeFileSync(
    join(fx.repo, "server.env"),
    "ALLIANCE_WITHOUT_TEAM_SECRETS=1\n",
  );
  expect(fx.run({}).log).toContain("aws ssm get-parameters-by-path");
});

test("refuses an ALLIANCE_WITHOUT_TEAM_SECRETS value the server's config would refuse", () => {
  fx.loadingEnvFile();
  writeFileSync(
    join(fx.repo, "server.env"),
    "ALLIANCE_WITHOUT_TEAM_SECRETS=yes\n",
  );
  const { exitCode, stderr, log } = fx.run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "ALLIANCE_WITHOUT_TEAM_SECRETS is yes; set it to 1 or 0",
  );
  expect(log).toBe("");
});

test("ALLIANCE_WITHOUT_TEAM_SECRETS=0 still reads Parameter Store", () => {
  const { log } = fx.run({ env: { ALLIANCE_WITHOUT_TEAM_SECRETS: "0" } });
  expect(log).toContain("app x ONE=1 TWO=2");
});

test("a Bun failure reading the env files fails with Bun's error", () => {
  fx.loadingEnvFile();
  writeFileSync(join(fx.repo, "bunfig.toml"), 'preload = ["./missing.ts"]\n');
  const { exitCode, stderr } = fx.run({});
  expect(exitCode).toBe(1);
  expect(stderr).toContain(
    "with-secrets.sh: bun could not read ALLIANCE_WITHOUT_TEAM_SECRETS from the env files of server:",
  );
  expect(stderr).toContain("missing.ts");
});
