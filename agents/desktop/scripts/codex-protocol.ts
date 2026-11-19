// Usage, from agents/desktop: bun scripts/codex-protocol.ts generate|check
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CODEX_VERSION } from "../src/main/agent/codex/version";

const committed = path.join(
  import.meta.dirname,
  "../src/main/agent/codex/protocol",
);

const mode = process.argv[2];
if (mode !== "generate" && mode !== "check")
  throw new Error("usage: bun scripts/codex-protocol.ts generate|check");

const raw = mkdtempSync(path.join(tmpdir(), "codex-protocol-"));
process.on("exit", () => rmSync(raw, { recursive: true, force: true }));
execFileSync(
  "bunx",
  [`@openai/codex@${CODEX_VERSION}`, "app-server", "generate-ts", "--out", raw],
  { stdio: ["ignore", "ignore", "inherit"] },
);

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => statSync(path.join(dir, file)).isFile())
    .sort();

// The repo names generated TypeScript *.gen.ts, which the max-lines lint and Prettier skip, so each relative import follows the rename.
const generated = new Map(
  filesUnder(raw).map((file) => {
    const text = readFileSync(path.join(raw, file), "utf8").replace(
      /from "(\.\.?\/[^"]+)"/g,
      (_, specifier: string) => {
        const target = path.join(raw, path.dirname(file), specifier);
        const isDir = statSync(target, {
          throwIfNoEntry: false,
        })?.isDirectory();
        return `from "${specifier}${isDir ? "/index" : ""}.gen"`;
      },
    );
    return [file.replace(/\.ts$/, ".gen.ts"), text];
  }),
);

if (mode === "generate") {
  rmSync(committed, { recursive: true, force: true });
  for (const [file, text] of generated) {
    mkdirSync(path.dirname(path.join(committed, file)), { recursive: true });
    writeFileSync(path.join(committed, file), text);
  }
  console.log(`wrote ${generated.size} files to ${committed}`);
} else {
  const existing = filesUnder(committed);
  const differing = [
    ...existing.filter(
      (file) =>
        generated.get(file) !==
        readFileSync(path.join(committed, file), "utf8"),
    ),
    ...[...generated.keys()].filter((file) => !existing.includes(file)),
  ];
  if (differing.length > 0) {
    console.error(
      `The committed Codex protocol types don't match Codex ${CODEX_VERSION}'s. Run bun scripts/codex-protocol.ts generate from agents/desktop. Differing files:\n${differing.join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `The committed Codex protocol types match Codex ${CODEX_VERSION}.`,
  );
}
