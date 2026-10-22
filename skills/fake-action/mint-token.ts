import jwt from "jsonwebtoken";
import path from "node:path";
import { envFileValue } from "../../common/src/dev-database";
import { queryLocalDb } from "../../scripts/lib/local-db";

const userId = Number(process.argv[2]);
if (!Number.isInteger(userId)) {
  throw new Error("usage: bun skills/fake-action/mint-token.ts <userId>");
}

const envFile = path.join(import.meta.dirname, "..", "..", "server", ".env");
const secret = envFileValue(envFile, "JWT_SECRET");
if (secret === null) throw new Error(`JWT_SECRET missing from ${envFile}`);

const [user] = queryLocalDb<{ email: string; sessionGeneration: number }>(
  `SELECT email, "sessionGeneration" FROM "user" WHERE id = ${userId}`,
);
if (!user) throw new Error(`no user ${userId}`);

// The session guard rejects tokens whose generation differs from the user row's.
console.log(
  jwt.sign(
    {
      sub: userId,
      email: user.email,
      tokenType: "access",
      sessionGeneration: user.sessionGeneration,
    },
    secret,
    { expiresIn: "1h" },
  ),
);
