import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { deployedConfigFor } from "../common/src/deployed-config";
import { NodeEnv } from "../common/src/node-env";

const ROOT = join(import.meta.dir, "..");
const SCRIPT = join(import.meta.dir, "deployed-db-name.ts");
const run = (...args: string[]) =>
  Bun.spawnSync(["bun", SCRIPT, ...args], { stderr: "pipe" });

test.each([NodeEnv.Staging, NodeEnv.Production] as const)(
  "prints %s's committed DB_NAME",
  (nodeEnv) => {
    const result = run(nodeEnv);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe(
      `${deployedConfigFor(nodeEnv).DB_NAME}\n`,
    );
  },
);

test.each([[[]], [["development"]], [["staging", "extra"]]])(
  "refuses %p",
  (args) => {
    const result = run(...args);
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toContain(
      "usage: bun scripts/deployed-db-name.ts <staging|production>",
    );
  },
);

test("the backend deploy zip ships every file deployed-db-name.ts imports", () => {
  const zipped = readFileSync(
    join(ROOT, ".github/workflows/deploy-environment.yaml"),
    "utf8",
  )
    .split("zip -r nest-build.zip \\\n")[1]
    .split(/(?<!\\)\n/)[0]
    .split("\\\n")
    .map((entry) => entry.trim());
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const files = [relative(ROOT, SCRIPT)];
  for (const file of files) {
    if (file.startsWith("common/src/")) continue;
    for (const { path } of transpiler.scanImports(
      readFileSync(join(ROOT, file), "utf8"),
    )) {
      if (path.startsWith(".")) {
        files.push(
          relative(ROOT, Bun.resolveSync(path, join(ROOT, dirname(file)))),
        );
      }
    }
  }
  const unshipped = files.filter(
    (file) =>
      !zipped.some((entry) => file === entry || file.startsWith(`${entry}/`)),
  );
  expect(files.length).toBeGreaterThan(2);
  expect(unshipped).toEqual([]);
});
