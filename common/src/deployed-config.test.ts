import { describe, expect, test } from "bun:test";
import { deployedConfigFor } from "./deployed-config";
import { isDeployed, NodeEnv } from "./node-env";

describe("deployedConfigFor", () => {
  test("has a config for exactly the deployed environments", () => {
    for (const nodeEnv of Object.values(NodeEnv)) {
      expect(deployedConfigFor(nodeEnv) !== undefined).toBe(
        isDeployed(nodeEnv),
      );
    }
  });
});
