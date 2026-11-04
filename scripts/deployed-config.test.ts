import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  deployedConfigEnv,
  deployedConfigFor,
} from "../common/src/deployed-config";
import { NodeEnv } from "../common/src/node-env";

const SCRIPT = join(import.meta.dir, "deployed-config.ts");
const run = (...args: string[]) =>
  Bun.spawnSync(["bun", SCRIPT, ...args], { stderr: "pipe" });

describe("deployed-config.ts", () => {
  test("prints the environment's config as GITHUB_OUTPUT lines", () => {
    for (const nodeEnv of [NodeEnv.Staging, NodeEnv.Production] as const) {
      const expected = Object.entries(
        deployedConfigEnv(deployedConfigFor(nodeEnv)),
      )
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`);
      expect(run(nodeEnv).stdout.toString().trim().split("\n")).toEqual(
        expected,
      );
    }
    expect(run(NodeEnv.Staging).stdout.toString()).not.toContain("WAITLIST_");
  });

  test("prints every key the deployed-config action reads", () => {
    const action = z
      .object({
        outputs: z.record(
          z.string(),
          z.object({
            value: z
              .string()
              .transform(
                (value) => /steps\.read\.outputs\.(\w+)/.exec(value)?.[1],
              )
              .pipe(z.string()),
          }),
        ),
      })
      .parse(
        Bun.YAML.parse(
          readFileSync(
            join(
              import.meta.dir,
              "../.github/actions/deployed-config/action.yml",
            ),
            "utf8",
          ),
        ),
      );
    for (const nodeEnv of [NodeEnv.Staging, NodeEnv.Production] as const) {
      const printed = run(nodeEnv)
        .stdout.toString()
        .trim()
        .split("\n")
        .map((line) => line.split("=")[0]);
      expect(printed).toEqual(
        expect.arrayContaining(
          Object.values(action.outputs).map((output) => output.value),
        ),
      );
    }
  });

  test("refuses an environment that isn't deployed", () => {
    for (const args of [[], ["development"], ["prod"], ["staging", "x"]]) {
      expect(run(...args).exitCode).toBe(2);
    }
  });
});
