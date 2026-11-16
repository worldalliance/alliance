/*
 * Removes every entry whose key matches a pattern, finding entries with dotenv's
 * own line grammar so `KEY = v`, `KEY: v` and multi-line quoted values go too.
 */
import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { R, type Result } from "../common/src/result";

// dotenv 17's LINE regex, with indices.
const LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/dgm;

export function withoutKeys(
  src: string,
  keyPattern: RegExp,
): Result<{ text: string; dropped: string[] }, string> {
  let lines = src.replace(/\r\n?/g, "\n");
  const dropped = new Set<string>();
  // Removing an entry can join the lines around it into a new one for it.
  for (;;) {
    let text = "";
    let kept = 0;
    for (const match of lines.matchAll(LINE)) {
      const key = match[1];
      if (key.search(keyPattern) === -1) continue;
      const { indices } = match;
      if (!indices) throw new Error("LINE lost its d flag");
      const [keyStart, keyEnd] = indices[1];
      const start = lines.lastIndexOf("\n", keyStart - 1) + 1;
      const newline = lines.indexOf("\n", indices[2]?.[1] ?? keyEnd);
      text += lines.slice(kept, start);
      kept = newline === -1 ? lines.length : newline + 1;
      dropped.add(key);
    }
    const out = text + lines.slice(kept);
    if (out === lines) break;
    lines = out;
  }
  const expected = parse(src);
  for (const key of Object.keys(expected)) {
    if (key.search(keyPattern) !== -1) delete expected[key];
  }
  if (!isDeepStrictEqual(parse(lines), expected)) {
    return R.failure(
      "removing the entries changed others; the file or dotenv's grammar is beyond this script",
    );
  }
  return R.success({ text: lines, dropped: [...dropped] });
}

function main(): void {
  const [file, pattern, mode, ...extra] = process.argv.slice(2);
  if (
    !file ||
    !pattern ||
    (mode !== undefined && mode !== "--names") ||
    extra.length > 0
  ) {
    console.error(
      "usage: bun scripts/env-without-keys.ts <file> <key-regex> [--names]",
    );
    process.exit(2);
  }
  const result = withoutKeys(
    readFileSync(file, "utf8"),
    new RegExp(`^(?:${pattern})$`),
  );
  if (!result.ok) {
    console.error(`env-without-keys: ${file}: ${result.error}`);
    process.exit(1);
  }
  const { text, dropped } = result.value;
  process.stdout.write(mode ? `${dropped.sort().join(", ")}\n` : text);
}

if (import.meta.main) main();
