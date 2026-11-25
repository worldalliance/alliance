import { parse } from "dotenv";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { R, type Result } from "../common/src/result";

type Setup = { adminUser: string; adminPassword: string };

export const ADMIN_USER = "admin@example.com";

type Paths = {
  envPath: string;
  examplePath: string;
  env: Record<string, string | undefined>;
};

export function setupWithoutTeamSecrets(params: Paths): Result<Setup, string> {
  return R.flatMap(
    R.fromThrowable(
      () => writeSetup(params),
      (error) => R.toError(error).message,
    ),
    (setup) => setup,
  );
}

function writeSetup(params: Paths): Result<Setup, string> {
  const { envPath, examplePath, env } = params;
  const generated = {
    ALLIANCE_WITHOUT_TEAM_SECRETS: "1",
    JWT_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    ADMIN_USER,
    ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
  };
  // Bun keeps an inherited variable over the env files, and the last file's
  // definition, even a blank one, over earlier ones.
  const sources: [string, Record<string, string | undefined>][] = [
    ["the shell or a .env file in the current directory", env],
    ...bunEnvFiles(envPath)
      .filter(existsSync)
      .map((file): [string, Record<string, string>] => [
        file,
        parse(readFileSync(file)),
      ]),
  ];
  const taken = sources.flatMap(([source, existing]) => {
    const keys = Object.keys(generated).filter((key) => key in existing);
    return keys.length ? [`${source} already sets ${keys.join(", ")}`] : [];
  });
  if (taken.length) return R.failure(`${taken.join("; ")}; nothing changed`);
  if (!existsSync(envPath)) copyFileSync(examplePath, envPath);
  appendFileSync(
    envPath,
    `\n# Written by scripts/setup-without-team-secrets.ts\n${Object.entries(
      generated,
    )
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
  return R.success({
    adminUser: generated.ADMIN_USER,
    adminPassword: generated.ADMIN_PASSWORD,
  });
}

// The env files Bun loads for the server, as with-secrets.sh lists them.
const bunEnvFiles = (envPath: string) =>
  ["", ".development", ".local", ".development.local"].map(
    (suffix) => envPath + suffix,
  );

if (import.meta.main) {
  const server = join(import.meta.dir, "../server");
  const envPath = join(server, ".env");
  const result = setupWithoutTeamSecrets({
    envPath,
    examplePath: join(server, ".env.example"),
    env: process.env,
  });
  if (!result.ok) {
    console.error(`setup-without-team-secrets: ${result.error}`);
    process.exit(1);
  }
  console.log(
    `Wrote ${envPath} for running without the team's secrets.\nThe server creates this admin on its next start, unless the database already has the account: ${result.value.adminUser} / ${result.value.adminPassword}`,
  );
}
