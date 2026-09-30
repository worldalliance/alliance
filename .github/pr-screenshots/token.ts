import { JwtService } from "@nestjs/jwt";
import { spawnSync } from "child_process";
import { parse } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { accessTokenPayload } from "../../server/src/auth/tokens";

const repoRoot = path.join(import.meta.dir, "../..");

function mintToken(email: string): string {
  const psql = spawnSync(
    "psql",
    ["-At", "-v", "ON_ERROR_STOP=1", "-v", `email=${email}`],
    {
      input: `select id from "user" where email = :'email';`,
      encoding: "utf8",
    },
  );
  if (psql.status !== 0) throw new Error(`psql failed: ${psql.stderr}`);
  const id = Number(psql.stdout.trim());
  if (!Number.isInteger(id) || id <= 0)
    throw new Error(`no user with email ${email}`);

  const secret = parse(readFileSync(path.join(repoRoot, "server", ".env")))[
    "JWT_SECRET"
  ];
  if (!secret) throw new Error("server/.env has no JWT_SECRET");
  return new JwtService().sign(accessTokenPayload({ user: { id, email } }), {
    secret,
    expiresIn: "1d",
  });
}

if (import.meta.main) {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: bun token.ts <email>");
    process.exit(2);
  }
  console.log(mintToken(email));
}
