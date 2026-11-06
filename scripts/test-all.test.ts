import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUN_TEST_FILE, testPackages } from "./lib/test-packages";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every test bun test discovers is in a test-all.sh package", () => {
  const packages = testPackages(repoRoot);
  const testFiles = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => BUN_TEST_FILE.test(file));

  expect(
    testFiles.filter(
      (file) => !packages.some((dir) => file.startsWith(`${dir}/`)),
    ),
  ).toEqual([]);
});
