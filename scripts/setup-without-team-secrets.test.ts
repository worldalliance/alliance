import { afterEach, beforeEach, expect, test } from "bun:test";
import { parse } from "dotenv";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ADMIN_USER,
  setupWithoutTeamSecrets,
} from "./setup-without-team-secrets";

let dir: string;
let envPath: string;
let examplePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "setup-without-team-secrets-"));
  envPath = join(dir, ".env");
  examplePath = join(dir, ".env.example");
  writeFileSync(examplePath, "DB_NAME=alliance\nJWT_SECRET=\n");
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

test("starts from the example and appends the flag, secrets and admin", () => {
  const result = setupWithoutTeamSecrets({ envPath, examplePath, env: {} });
  if (!result.ok) throw new Error(result.error);
  const written = parse(readFileSync(envPath));
  expect(written.DB_NAME).toBe("alliance");
  expect(written.ALLIANCE_WITHOUT_TEAM_SECRETS).toBe("1");
  expect(written.JWT_SECRET).toMatch(/^[0-9a-f]{64}$/);
  expect(written.JWT_REFRESH_SECRET).toMatch(/^[0-9a-f]{64}$/);
  expect(written.JWT_REFRESH_SECRET).not.toBe(written.JWT_SECRET);
  expect(written.ADMIN_USER).toBe(ADMIN_USER);
  expect(written.ADMIN_PASSWORD).toBe(result.value.adminPassword);
  expect(result.value.adminPassword.length).toBeGreaterThanOrEqual(24);
});

test("keeps an existing env file's other keys", () => {
  writeFileSync(envPath, "DB_NAME=mine\n");
  expect(setupWithoutTeamSecrets({ envPath, examplePath, env: {} }).ok).toBe(
    true,
  );
  expect(parse(readFileSync(envPath)).DB_NAME).toBe("mine");
});

test("refuses to replace a value already set, naming it", () => {
  writeFileSync(envPath, "JWT_SECRET=kept\nADMIN_USER=me@example.com\n");
  expect(setupWithoutTeamSecrets({ envPath, examplePath, env: {} })).toEqual({
    ok: false,
    error: `${envPath} already sets JWT_SECRET, ADMIN_USER; nothing changed`,
  });
  expect(readFileSync(envPath, "utf8")).toBe(
    "JWT_SECRET=kept\nADMIN_USER=me@example.com\n",
  );
});

test("refuses a value a later env file sets, naming the file", () => {
  writeFileSync(`${envPath}.local`, "ADMIN_PASSWORD=other\n");
  expect(setupWithoutTeamSecrets({ envPath, examplePath, env: {} })).toEqual({
    ok: false,
    error: `${envPath}.local already sets ADMIN_PASSWORD; nothing changed`,
  });
  expect(existsSync(envPath)).toBe(false);
});

test("refuses a key a later env file blanks", () => {
  writeFileSync(`${envPath}.development`, "JWT_SECRET=\n");
  expect(setupWithoutTeamSecrets({ envPath, examplePath, env: {} })).toEqual({
    ok: false,
    error: `${envPath}.development already sets JWT_SECRET; nothing changed`,
  });
});

test("refuses a key the environment sets, since Bun keeps it", () => {
  expect(
    setupWithoutTeamSecrets({
      envPath,
      examplePath,
      env: { ADMIN_PASSWORD: "exported" },
    }),
  ).toEqual({
    ok: false,
    error:
      "the shell or a .env file in the current directory already sets ADMIN_PASSWORD; nothing changed",
  });
  expect(existsSync(envPath)).toBe(false);
});

test("reports a file it cannot read as a failure", () => {
  const missing = join(dir, "missing.env.example");
  expect(
    setupWithoutTeamSecrets({ envPath, examplePath: missing, env: {} }),
  ).toEqual({
    ok: false,
    error: expect.stringContaining(missing),
  });
});
