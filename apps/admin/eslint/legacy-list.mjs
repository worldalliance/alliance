// Rewrites legacy-files.txt. Run from apps/admin:
//   bun eslint/legacy-list.mjs          drops the files that now pass; never adds one
//   bun eslint/legacy-list.mjs --init   lists every file that breaks a design rule
import { ESLint } from "eslint";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_LIST, readLegacyFiles } from "./legacy.mjs";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const init = process.argv.includes("--init");
const listed = init ? null : new Set(readLegacyFiles());

process.env.ADMIN_LINT_LEGACY = "off";
const results = await new ESLint({ cwd: adminRoot }).lintFiles(["src"]);
const failing = results
  .filter((result) =>
    result.messages.some((message) => message.ruleId?.startsWith("admin/")),
  )
  .map((result) => relative(adminRoot, result.filePath))
  .filter((file) => listed === null || listed.has(file))
  .sort();

const header = readFileSync(LEGACY_LIST, "utf8")
  .split("\n")
  .filter((line) => line.startsWith("#"));
writeFileSync(LEGACY_LIST, [...header, ...failing, ""].join("\n"));
console.log(`${failing.length} legacy files`);
