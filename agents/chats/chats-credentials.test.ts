import { expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  awsScript,
  dir,
  exported,
  fakeAws,
  hook,
  loggedIn,
  requests,
  run,
  useChatsFixture,
} from "./chats-fixture";

useChatsFixture();

test("check warns the session when the login is expired", async () => {
  const { exitCode, stdout } = await run(["check"]);
  expect(exitCode).toBe(0);
  const { systemMessage } = JSON.parse(stdout);
  expect(systemMessage).toContain("aws sso login");
  expect(systemMessage.split("agents/README.md")).toHaveLength(2);
  expect(requests()).toEqual([]);
});

test("check states the login error once when uploads failed on it", async () => {
  await hook("SubagentStop");
  await run(["retry"]);
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain(
    "Upload failed for claude/abc.jsonl for the same reason",
  );
  expect(systemMessage.split("your AWS login has expired")).toHaveLength(2);
});

test("check names the login command for a revoked login", async () => {
  fakeAws({
    stderr:
      "An error occurred (UnauthorizedException) when calling the GetRoleCredentials operation: Session token not found or invalid",
    exitCode: 255,
  });
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain("aws sso login --profile alliance-dev");
});

test("check points at the setup doc when the profile does not exist", async () => {
  fakeAws({
    stderr: "The config profile (alliance-dev) could not be found",
    exitCode: 255,
  });
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain("profile is not set up");
  expect(systemMessage).not.toContain("aws sso login");
});

test("check sends an unassigned login to an admin", async () => {
  fakeAws({
    stderr:
      "An error occurred (ForbiddenException) when calling the GetRoleCredentials operation: No access",
    exitCode: 255,
  });
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain(
    "ask an admin to check your alliance-dev assignment",
  );
});

test("check names a missing aws CLI", async () => {
  const empty = join(dir, "empty");
  mkdirSync(empty);
  const { stdout } = await run(["check"], "", { PATH: empty });
  expect(JSON.parse(stdout).systemMessage).toContain(
    "could not run the aws CLI: ",
  );
});

test("check reports any other aws failure", async () => {
  fakeAws({ stderr: "Could not connect to the endpoint URL", exitCode: 255 });
  const { stdout } = await run(["check"]);
  expect(JSON.parse(stdout).systemMessage).toContain(
    "Could not connect to the endpoint URL",
  );
});

test("check reports an aws CLI that runs past its 8s", async () => {
  awsScript("exec sleep 9");
  const { stdout } = await run(["check"]);
  expect(JSON.parse(stdout).systemMessage).toContain(
    "aws configure export-credentials did not finish in 8s",
  );
}, 15_000);

test("check reports an aws CLI killed by a signal", async () => {
  awsScript("kill -KILL $$");
  const { stdout } = await run(["check"]);
  expect(JSON.parse(stdout).systemMessage).toContain(
    "aws was killed by SIGKILL",
  );
});

test("check is silent when the login exports session credentials", async () => {
  fakeAws(loggedIn);
  expect(await run(["check"])).toMatchObject({ exitCode: 0, stdout: "" });
});

test("check names a profile that returns no session token", async () => {
  const { SessionToken: _, ...tokenless } = exported;
  fakeAws({ stdout: JSON.stringify(tokenless), exitCode: 0 });
  expect(JSON.parse((await run(["check"])).stdout).systemMessage).toContain(
    "did not return SSO session credentials",
  );
});

test("check names aws output that is not JSON", async () => {
  fakeAws({ stdout: "not json", exitCode: 0 });
  expect(JSON.parse((await run(["check"])).stdout).systemMessage).toContain(
    "aws configure export-credentials printed something other than JSON",
  );
});

test("check names a fallback flag other than 1", async () => {
  const { stdout } = await run(["check"], "", {
    ALLIANCE_SECRETS_ENV_FALLBACK: "true",
  });
  expect(JSON.parse(stdout).systemMessage).toContain(
    "ALLIANCE_SECRETS_ENV_FALLBACK is true",
  );
});

test("the fallback flag never runs aws", async () => {
  writeFileSync(join(dir, "aws"), `#!/usr/bin/env bash\ntouch "${dir}/ran"\n`);
  expect(
    await run(["check"], "", { ALLIANCE_SECRETS_ENV_FALLBACK: "1" }),
  ).toMatchObject({ exitCode: 0, stderr: "" });
  expect(existsSync(join(dir, "ran"))).toBe(false);
});
