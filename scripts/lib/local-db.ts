import { execFileSync } from "node:child_process";
import path from "node:path";
import { envFileValue } from "../../common/src/dev-database";

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function envValue(key: string): string {
  const envFile = path.join(import.meta.dirname, "..", "..", "server", ".env");
  const found = envFileValue(envFile, key);
  if (found === null) throw new Error(`${key} missing from ${envFile}`);
  return found;
}

/** Rows come back JSON-encoded, so timestamps arrive as ISO strings, in UTC. */
export function queryLocalDb<Row>(sql: string): Row[] {
  const output = execFileSync(
    "psql",
    [
      "-h",
      envValue("DB_HOST"),
      "-p",
      envValue("DB_PORT"),
      "-U",
      envValue("DB_USERNAME"),
      "-d",
      envValue("DB_NAME"),
      "-Atc",
      `SELECT coalesce(json_agg(rows), '[]') FROM (${sql}) rows`,
    ],
    {
      encoding: "utf8",
      maxBuffer: MAX_OUTPUT_BYTES,
      env: {
        ...process.env,
        PGPASSWORD: envValue("DB_PASSWORD"),
        PGTZ: "UTC",
      },
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return JSON.parse(output);
}
