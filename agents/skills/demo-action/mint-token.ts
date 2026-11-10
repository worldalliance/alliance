import { JwtService } from "@nestjs/jwt";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { envFileValue } from "../../../common/src/dev-database";

const envFile = path.join(import.meta.dirname, "../../../server/.env");
const env = (key: string): string => {
  const value = envFileValue(envFile, key);
  if (value === null) throw new Error(`${key} missing from ${envFile}`);
  return value;
};

const userId = Number(process.argv[2]);
if (!Number.isInteger(userId)) {
  throw new Error("usage: bun agents/skills/demo-action/mint-token.ts <userId>");
}

const row = execFileSync(
  "psql",
  [
    ...["-h", env("DB_HOST"), "-p", env("DB_PORT")],
    ...["-U", env("DB_USERNAME"), "-d", env("DB_NAME"), "-At"],
    "-c",
    `SELECT json_build_object('email', email, 'sessionGeneration', "sessionGeneration") FROM "user" WHERE id = ${userId}`,
  ],
  { encoding: "utf8", env: { ...process.env, PGPASSWORD: env("DB_PASSWORD") } },
).trim();
if (!row) throw new Error(`no user ${userId}`);
const user: { email: string; sessionGeneration: number } = JSON.parse(row);

// The session guard rejects tokens whose generation differs from the user row's.
console.log(
  new JwtService({ secret: env("JWT_SECRET") }).sign(
    {
      sub: userId,
      email: user.email,
      tokenType: "access",
      sessionGeneration: user.sessionGeneration,
    },
    { expiresIn: "1h" },
  ),
);
