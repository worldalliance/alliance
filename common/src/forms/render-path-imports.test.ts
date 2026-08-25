import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Form renderers must not import the several-megabyte TypeScript compiler. Only
// the variable builder and schema validator need formula type-checking.
const RENDER_PATH_ENTRIES = [
  "./variables.ts",
  "./form-schema.ts",
  "./variable-interpolation.ts",
  "./visibility.ts",
];

// Matches imports, re-exports, and side-effect imports.
const IMPORT_PATTERN =
  /^\s*(?:import|export)\b\s*(?:[^'"]*\bfrom\s*)?["']([^"']+)["']/gm;

function importsOf(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(IMPORT_PATTERN)].map(
    (match) => match[1],
  );
}

function reachableFrom(entries: readonly string[]): Map<string, string[]> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const seen = new Map<string, string[]>();
  const queue = entries.map((entry) => ({
    file: resolve(here, entry),
    via: [entry],
  }));

  while (queue.length > 0) {
    const { file, via } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.set(file, via);
    for (const specifier of importsOf(file)) {
      if (!specifier.startsWith(".")) continue;
      const next = resolve(dirname(file), specifier);
      queue.push({
        file: next.endsWith(".ts") ? next : `${next}.ts`,
        via: [...via, specifier],
      });
    }
  }
  return seen;
}

describe("the form render path", () => {
  const reachable = reachableFrom(RENDER_PATH_ENTRIES);

  it("reaches more than its own entry points", () => {
    expect(reachable.size).toBeGreaterThan(RENDER_PATH_ENTRIES.length);
  });

  it("imports no TypeScript compiler, directly or through another module", () => {
    const offenders = [...reachable].flatMap(([file, via]) =>
      importsOf(file).some(
        (specifier) =>
          specifier === "typescript" || specifier.endsWith("formula-lib"),
      )
        ? [`${via.join(" -> ")} (${file})`]
        : [],
    );
    expect(offenders).toEqual([]);
  });
});
