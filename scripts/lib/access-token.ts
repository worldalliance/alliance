import { JwtService } from "@nestjs/jwt";
import path from "node:path";
import { envFileValue } from "../../common/src/dev-database";
import { queryLocalDb } from "./local-db";

/** A one-hour access token for a local user, as the API's AuthGuard accepts it. */
export function mintAccessToken(userId: number): string {
  const envFile = path.join(import.meta.dirname, "..", "..", "server", ".env");
  const secret = envFileValue(envFile, "JWT_SECRET");
  if (secret === null) throw new Error(`JWT_SECRET missing from ${envFile}`);

  const [user] = queryLocalDb<{ email: string; sessionGeneration: number }>(
    `SELECT email, "sessionGeneration" FROM "user" WHERE id = ${userId}`,
  );
  if (!user) throw new Error(`no user ${userId}`);

  // The session guard rejects tokens whose generation differs from the user row's.
  return new JwtService({ secret }).sign(
    {
      sub: userId,
      email: user.email,
      tokenType: "access",
      sessionGeneration: user.sessionGeneration,
    },
    { expiresIn: "1h" },
  );
}
