import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { NodeEnv } from "../common/src/node-env";
import { webRuntimeConfigSchema } from "../common/src/web-env";

const SCRIPT = join(import.meta.dir, "web-runtime-config.ts");
const run = (...args: string[]) =>
  Bun.spawnSync(["bun", SCRIPT, ...args], { stderr: "pipe" });

describe("web-runtime-config.ts", () => {
  test("prints config.json that admin's schema accepts, per environment", () => {
    for (const nodeEnv of [NodeEnv.Staging, NodeEnv.Production]) {
      const parsed = webRuntimeConfigSchema.parse(
        JSON.parse(run(nodeEnv).stdout.toString()),
      );
      expect(parsed.environment).toBe(nodeEnv);
    }
  });

  test.each([[], ["development"], ["prod"], ["staging", "extra"]])(
    "refuses %p",
    (...args: string[]) => {
      const result = run(...args);
      expect(result.exitCode).toBe(2);
      expect(result.stderr.toString()).toContain("usage:");
    },
  );
});
