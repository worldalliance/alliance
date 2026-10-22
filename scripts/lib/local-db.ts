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
  return JSON.parse(
    runPsql(`SELECT coalesce(json_agg(rows), '[]') FROM (${sql}) rows`),
  );
}

/** For writes, which Postgres refuses inside the subquery `queryLocalDb` wraps. */
export function execLocalDb(sql: string): void {
  runPsql(sql);
}

function runPsql(command: string): string {
  return execFileSync(
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
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      command,
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
}
