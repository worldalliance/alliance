import { NodeEnv } from "@alliance/common/node-env";
import { Features, isEnabled } from "@alliance/shared/lib/features";
import { setWebRuntimeConfig } from "@alliance/sharedweb/lib/runtimeConfig";
import { deployedWebRuntimeConfig } from "@alliance/sharedweb/lib/testing/runtimeConfig";
import { afterEach, describe, expect, test } from "bun:test";
import { getAdminUrl, getSiteUrl, isFeatureEnabled } from "./config";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

describe("getSiteUrl", () => {
  afterEach(() => window.happyDOM.setURL("http://localhost:3000/"));

  test.each([
    "https://thealliance.org",
    "https://worldalliance.org",
    "https://staging.thealliance.org",
  ])("follows the domain the page was loaded on: %s", (origin) => {
    window.happyDOM.setURL(`${origin}/actions/1`);

    expect(getSiteUrl()).toBe(origin);
  });
});

describe("getAdminUrl", () => {
  afterEach(() => window.happyDOM.setURL("http://localhost:3000/"));

  test("follows the domain the page was loaded on", () => {
    window.happyDOM.setURL("https://www.thealliance.org/actions/1");

    expect(getAdminUrl()).toBe("https://admin.thealliance.org");
  });
});

describe("isFeatureEnabled", () => {
  test.each([NodeEnv.Staging, NodeEnv.Production])(
    "follows the runtime environment, not the build mode: %s",
    (environment) => {
      setWebRuntimeConfig(deployedWebRuntimeConfig(environment));

      for (const feature of Object.values(Features)) {
        expect(isFeatureEnabled(feature)).toBe(isEnabled(feature, environment));
      }
    },
  );
});
