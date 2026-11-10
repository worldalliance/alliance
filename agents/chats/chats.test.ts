import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "chats.ts");

let dir: string;

function fakeAws(params: {
  stderr?: string;
  stdout?: string;
  exitCode: number;
}) {
  writeFileSync(join(dir, "stdout"), params.stdout ?? "");
  writeFileSync(
    join(dir, "aws"),
    `#!/usr/bin/env bash
cat "${join(dir, "stdout")}"
echo "${params.stderr ?? ""}" >&2
exit ${params.exitCode}
`,
  );
  chmodSync(join(dir, "aws"), 0o755);
}

const expired = {
  stderr: "Token has expired and refresh failed",
  exitCode: 254,
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "chats-"));
  fakeAws(expired);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

function run(args: string[], stdin = "", env: Record<string, string> = {}) {
  const result = Bun.spawnSync([process.execPath, SCRIPT, ...args], {
    stdin: Buffer.from(stdin),
    env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, ...env },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

test("an expired login fails the upload naming the login command", () => {
  const transcript = join(dir, "session.jsonl");
  writeFileSync(transcript, "{}\n");
  const { exitCode, stderr } = run(
    ["upload", "claude"],
    JSON.stringify({ session_id: "abc", transcript_path: transcript }),
  );
  expect(exitCode).toBe(1);
  expect(stderr).toContain("aws sso login --profile alliance-dev");
});

test("check warns the session when the login is expired", () => {
  const { exitCode, stdout } = run(["check"]);
  expect(exitCode).toBe(0);
  const { systemMessage } = JSON.parse(stdout);
  expect(systemMessage).toContain("aws sso login");
  expect(systemMessage.split("agents/README.md")).toHaveLength(2);
});

test("check names the login command for a revoked login", () => {
  fakeAws({
    stderr:
      "An error occurred (UnauthorizedException) when calling the GetRoleCredentials operation: Session token not found or invalid",
    exitCode: 255,
  });
  const { systemMessage } = JSON.parse(run(["check"]).stdout);
  expect(systemMessage).toContain("aws sso login --profile alliance-dev");
});

test("check points at the setup doc when the profile does not exist", () => {
  fakeAws({
    stderr: "The config profile (alliance-dev) could not be found",
    exitCode: 255,
  });
  const { stdout } = run(["check"]);
  const { systemMessage } = JSON.parse(stdout);
  expect(systemMessage).toContain("profile is not set up");
  expect(systemMessage).not.toContain("aws sso login");
});

test("check sends an unassigned login to an admin", () => {
  fakeAws({
    stderr:
      "An error occurred (ForbiddenException) when calling the GetRoleCredentials operation: No access",
    exitCode: 255,
  });
  const { systemMessage } = JSON.parse(run(["check"]).stdout);
  expect(systemMessage).toContain(
    "ask an admin to check your alliance-dev assignment",
  );
});

test("check names a missing aws CLI", () => {
  const empty = join(dir, "empty");
  mkdirSync(empty);
  const { stdout } = run(["check"], "", { PATH: empty });
  expect(JSON.parse(stdout).systemMessage).toContain(
    "could not run the aws CLI: ",
  );
});

test("check reports any other aws failure", () => {
  fakeAws({ stderr: "Could not connect to the endpoint URL", exitCode: 255 });
  const { stdout } = run(["check"]);
  expect(JSON.parse(stdout).systemMessage).toContain(
    "Could not connect to the endpoint URL",
  );
});

function awsScript(body: string) {
  writeFileSync(join(dir, "aws"), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(dir, "aws"), 0o755);
}

test("check reports an aws CLI that runs past its 8s", () => {
  awsScript("exec sleep 9");
  const { stdout } = run(["check"]);
  expect(JSON.parse(stdout).systemMessage).toContain(
    "aws configure export-credentials did not finish in 8s",
  );
}, 15_000);

test("check reports an aws CLI killed by a signal", () => {
  awsScript("kill -KILL $$");
  const { stdout } = run(["check"]);
  expect(JSON.parse(stdout).systemMessage).toContain(
    "aws was killed by SIGKILL",
  );
});

const exported = {
  Version: 1,
  AccessKeyId: "ASIAEXAMPLE",
  SecretAccessKey: "secret",
  SessionToken: "token",
  Expiration: "2030-01-01T00:00:00Z",
};

test("check is silent when the login exports session credentials", () => {
  fakeAws({ stdout: JSON.stringify(exported), exitCode: 0 });
  expect(run(["check"])).toMatchObject({ exitCode: 0, stdout: "" });
});

test("check names a profile that returns no session token", () => {
  const { SessionToken: _, ...tokenless } = exported;
  fakeAws({ stdout: JSON.stringify(tokenless), exitCode: 0 });
  expect(JSON.parse(run(["check"]).stdout).systemMessage).toContain(
    "did not return SSO session credentials",
  );
});

test("check names aws output that is not JSON", () => {
  fakeAws({ stdout: "not json", exitCode: 0 });
  expect(JSON.parse(run(["check"]).stdout).systemMessage).toContain(
    "aws configure export-credentials printed something other than JSON",
  );
});

test("check names a fallback flag other than 1", () => {
  const { systemMessage } = JSON.parse(
    run(["check"], "", { ALLIANCE_SECRETS_ENV_FALLBACK: "true" }).stdout,
  );
  expect(systemMessage).toContain("ALLIANCE_SECRETS_ENV_FALLBACK is true");
});

test("the fallback flag never runs aws", () => {
  writeFileSync(join(dir, "aws"), `#!/usr/bin/env bash\ntouch "${dir}/ran"\n`);
  expect(
    run(["check"], "", { ALLIANCE_SECRETS_ENV_FALLBACK: "1" }),
  ).toMatchObject({ exitCode: 0, stderr: "" });
  expect(existsSync(join(dir, "ran"))).toBe(false);
});
