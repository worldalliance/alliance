import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUN_TEST_FILE, testPackages } from "./lib/test-packages";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// desktop.yaml runs these, since they need the app's own install.
const OWN_CI = ["agents/desktop"];

test("every test bun test discovers runs in test-all.sh or desktop.yaml", () => {
  const covered = [...testPackages(repoRoot), ...OWN_CI];
  const testFiles = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => BUN_TEST_FILE.test(file));

  expect(
    testFiles.filter(
      (file) => !covered.some((dir) => file.startsWith(`${dir}/`)),
    ),
  ).toEqual([]);
});
