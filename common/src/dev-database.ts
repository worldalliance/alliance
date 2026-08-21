import { parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * Reads a value with dotenv semantics. Shell database commands share this
 * parser because inline comments and quotes must not change a DROP target.
 */
export function envFileValue(file: string, key: string): string | null {
  if (!fs.existsSync(file)) return null;

  return parse(fs.readFileSync(file, "utf8"))[key] ?? null;
}

export function devDatabaseOnDisk(repoRoot: string): string | null {
  return envFileValue(path.join(repoRoot, "server", ".env"), "DB_NAME");
}

/** No-ops when server/.env is absent. */
export function assertNotDevDatabase({
  repoRoot,
  database,
  action,
  recovery,
}: {
  repoRoot: string;
  database: string;
  action: string;
  recovery: string;
}): void {
  if (database !== devDatabaseOnDisk(repoRoot)) return;

  throw new Error(
    `refusing to ${action} ${database}, which server/.env names as this checkout's dev database. ${recovery}`,
  );
}
