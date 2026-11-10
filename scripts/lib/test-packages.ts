import fs from "node:fs";
import path from "node:path";

// Bun's discovery rule, which test-all.sh's grep repeats.
export const BUN_TEST_FILE = /[._](test|spec)\.([cm]?[jt]s|[jt]sx)$/;

export function testPackages(repoRoot: string): string[] {
  const testAll = fs.readFileSync(
    path.join(repoRoot, "scripts/test-all.sh"),
    "utf8",
  );
  const list = /^PACKAGES=\((.*)\)$/m.exec(testAll);
  if (!list) throw new Error("no PACKAGES=(...) line in scripts/test-all.sh");
  return list[1].split(/\s+/);
}
