import {
  assertWorktreeDatabase,
  DevDatabase,
  devPorts,
  PortCaller,
} from "@alliance/common/dev-ports";
import { JwtService } from "@nestjs/jwt";
import { execFileSync } from "node:child_process";

const usage =
  "usage: (cd server && ../scripts/with-secrets.sh server bun ../agents/skills/demo-action/mint-token.ts <userId> [hours])";

// Bun loads server/.env and its siblings only when run from server/, as the server is.
const env = (key: string): string => {
  const value = process.env[key];
  if (value === undefined) throw new Error(`${key} is not set; ${usage}`);
  return value;
};

const [userArg, hoursArg = "1"] = process.argv.slice(2);
const userId = Number(userArg);
const hours = Number(hoursArg);
if ([userId, hours].some((n) => !Number.isSafeInteger(n) || n < 1)) {
  throw new Error(usage);
}

const database = env("DB_NAME");
assertWorktreeDatabase({
  ports: devPorts(PortCaller.Server),
  which: DevDatabase.Dev,
  actual: database,
});

const row = execFileSync(
  "psql",
  [
    ...["-h", env("DB_HOST"), "-U", env("DB_USERNAME")],
    ...["-d", database, "-At"],
    "-c",
    `SELECT json_build_object('email', email, 'sessionGeneration', "sessionGeneration") FROM "user" WHERE id = ${userId}`,
  ],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      PGPORT: process.env.DB_PORT,
      PGPASSWORD: process.env.DB_PASSWORD,
    },
  },
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
    { expiresIn: hours * 3600 },
  ),
);
