/** Line numbers each file gains in a `git diff -U0` against its base. */
export function parseAddedLines(diff: string): Map<string, Set<number>> {
  const added = new Map<string, Set<number>>();
  let lines: Set<number> | undefined;
  let inHeader = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) inHeader = true;
    if (line.startsWith("@@")) inHeader = false;
    if (inHeader && line.startsWith("+++ ")) {
      // Git ends the header with a tab when the path has a space, and quotes a
      // path holding `"` or `\`.
      const file = line.slice(4).replace(/\t$/, "");
      if (file.startsWith('"')) throw new Error(`quoted path in diff: ${file}`);
      lines = file.startsWith("b/") ? new Set() : undefined;
      if (lines) added.set(file.slice(2), lines);
      continue;
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && lines) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let i = 0; i < count; i++) lines.add(start + i);
    }
  }
  return added;
}

/** The failed tests and errors a `bun test` run printed, or its exit code when it named none. */
export function testFailures({
  output,
  status,
}: {
  output: string;
  status: number | null;
}): string[] {
  if (status === 0) return [];
  const named = [...output.matchAll(/^(?:\(fail\)|error:) .*$/gm)].map(
    (m) => m[0],
  );
  return named.length > 0 ? named : [`bun test exited ${status}`];
}

/** Hit counts per executable line, keyed by each record's `SF:` path. */
export function parseLcov(lcov: string): Map<string, Map<number, number>> {
  const files = new Map<string, Map<number, number>>();
  let hits: Map<number, number> | undefined;
  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      hits = new Map();
      files.set(line.slice(3), hits);
    } else if (line.startsWith("DA:") && hits) {
      const [lineNumber, count] = line.slice(3).split(",").map(Number);
      hits.set(lineNumber, count);
    }
  }
  return files;
}

/** `[1, 2, 3, 7]` → `"1-3, 7"`. */
export function lineRanges(lines: number[]): string {
  const ranges: string[] = [];
  const sorted = [...lines].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return ranges.join(", ");
}
