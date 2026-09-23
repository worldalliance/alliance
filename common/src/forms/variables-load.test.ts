import { join } from "node:path";

// Loads `variables` before `form-schema`, which fails if `variables` imports
// `form-schema` at runtime: `form-schema` reads `formVariableSchema` as it loads.
// A fresh process, because other test files in the run load `form-schema` first.
it("loads before form-schema", () => {
  const path = join(import.meta.dir, "variables.ts");
  const { exitCode, stderr } = Bun.spawnSync([
    process.execPath,
    "-e",
    `await import(${JSON.stringify(path)})`,
  ]);
  expect(stderr.toString()).toBe("");
  expect(exitCode).toBe(0);
});
