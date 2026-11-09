import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { git } from "./lib/git";
import { BUN_TEST_FILE, testPackages } from "./lib/test-packages";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const fixtureRoot = path.join(scriptDir, ".tmp-test", "test-all");

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

test.each(["js", "ts", "jsx", "tsx", "mjs", "cjs", "mts", "cts"])(
  "test-all.sh runs a package whose only test is .%s",
  (extension) => {
    fs.mkdirSync(fixtureRoot, { recursive: true });
    const sandbox = fs.mkdtempSync(path.join(fixtureRoot, "run-"));
    fs.mkdirSync(path.join(sandbox, "scripts"));
    fs.mkdirSync(path.join(sandbox, "pkg"));
    fs.copyFileSync(
      path.join(scriptDir, "test-all.sh"),
      path.join(sandbox, "scripts/test-all.sh"),
    );
    fs.writeFileSync(
      path.join(sandbox, `pkg/only.test.${extension}`),
      'test("only", () => expect(1).toBe(1));\n',
    );

    const { status, stdout, stderr } = spawnSync(
      "bash",
      [path.join(sandbox, "scripts/test-all.sh"), "pkg"],
      { encoding: "utf8" },
    );

    expect(stdout).not.toContain("no test files");
    expect(`${stdout}${stderr}`).toContain("1 pass");
    expect(status).toBe(0);
  },
);

test("every test bun test discovers runs in test-all.sh", () => {
  const packages = testPackages(repoRoot);
  const testFiles = git({ repoRoot, args: ["ls-files", "-z"] })
    .toString("utf8")
    .split("\0")
    .filter((file) => BUN_TEST_FILE.test(file));

  expect(
    testFiles.filter(
      (file) => !packages.some((dir) => file.startsWith(`${dir}/`)),
    ),
  ).toEqual([]);
});
