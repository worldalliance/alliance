import { Features, isEnabled } from "@alliance/common/features";
import { NodeEnv } from "@alliance/common/node-env";
import { describe, expect, it } from "bun:test";
import {
  getApiUrl,
  getInviteBaseUrl,
  isFeatureEnabled,
  isProduction,
  isStaging,
} from "./config";
import { setWebRuntimeConfig } from "./runtimeConfig";
import {
  deployedWebRuntimeConfig,
  setTestWebRuntimeConfig,
} from "./testing/runtimeConfig";

describe("getApiUrl", () => {
  it("appends /api to VITE_API_URL outside development", () => {
    expect(getApiUrl()).toBe("https://alliance.test/api");
  });

  it("throws when VITE_API_URL is unset", () => {
    setTestWebRuntimeConfig({ VITE_API_URL: "" });
    expect(() => getApiUrl()).toThrow("VITE_API_URL: missing");
  });
});

describe("getInviteBaseUrl", () => {
  it.each([
    ["https://staging.worldalliance.org", "https://staging.thealliance.org"],
    ["https://staging.thealliance.org", "https://staging.worldalliance.org"],
  ])(
    "uses whichever domain is off worldalliance.org (VITE_API_URL %s)",
    (api, alt) => {
      setTestWebRuntimeConfig({ VITE_API_URL: api, VITE_ALT_APP_URL: alt });
      expect(getInviteBaseUrl()).toBe("https://staging.thealliance.org");
    },
  );
});

describe("isStaging and isProduction", () => {
  const deployed = (environment: NodeEnv.Staging | NodeEnv.Production) =>
    setWebRuntimeConfig(deployedWebRuntimeConfig(environment));

  it("read the environment from the runtime config", () => {
    deployed(NodeEnv.Staging);
    expect([isStaging(), isProduction()]).toEqual([true, false]);
    deployed(NodeEnv.Production);
    expect([isStaging(), isProduction()]).toEqual([false, true]);
  });

  it("are both false in tests", () => {
    expect([isStaging(), isProduction()]).toEqual([false, false]);
  });
});

describe("isFeatureEnabled", () => {
  it.each([NodeEnv.Staging, NodeEnv.Production])(
    "follows the runtime environment, not the build mode: %s",
    (environment) => {
      setWebRuntimeConfig(deployedWebRuntimeConfig(environment));

      for (const feature of Object.values(Features)) {
        expect(isFeatureEnabled(feature)).toBe(isEnabled(feature, environment));
      }
    },
  );
});
