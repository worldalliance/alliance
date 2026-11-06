import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
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
