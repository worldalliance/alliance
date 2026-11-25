import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LEGACY_LIST = join(adminRoot, "eslint/legacy-files.txt");

/**
 * The files the design rules don't apply to yet, as paths from `apps/admin`.
 * `ADMIN_LINT_LEGACY=off` empties it, which is how `legacy-list.mjs` finds the
 * files that still break a rule.
 */
export function readLegacyFiles() {
  if (process.env.ADMIN_LINT_LEGACY === "off") return [];
  const files = readFileSync(LEGACY_LIST, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const missing = files.filter((file) => !existsSync(join(adminRoot, file)));
  if (missing.length > 0) {
    throw new Error(
      `apps/admin/eslint/legacy-files.txt lists files that don't exist; delete their lines:\n${missing.join("\n")}`,
    );
  }
  return files;
}
