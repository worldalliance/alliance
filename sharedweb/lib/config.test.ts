import { setEnv } from "@alliance/common/set-env";
import { describe, expect, it } from "bun:test";
import { getApiUrl, getInviteBaseUrl } from "./config";

describe("getApiUrl", () => {
  it("appends /api to VITE_API_URL outside development", () => {
    expect(getApiUrl()).toBe(`${process.env.VITE_API_URL}/api`);
  });

  it("throws when VITE_API_URL is unset", () => {
    const saved = process.env.VITE_API_URL;
    delete process.env.VITE_API_URL;
    try {
      expect(() => getApiUrl()).toThrow("VITE_API_URL: missing");
    } finally {
      setEnv("VITE_API_URL", saved);
    }
  });
});

describe("getInviteBaseUrl", () => {
  it.each([
    ["https://staging.worldalliance.org", "https://staging.thealliance.org"],
    ["https://staging.thealliance.org", "https://staging.worldalliance.org"],
  ])(
    "uses whichever domain is off worldalliance.org (VITE_API_URL %s)",
    (api, alt) => {
      const saved = [process.env.VITE_API_URL, process.env.VITE_ALT_APP_URL];
      process.env.VITE_API_URL = api;
      process.env.VITE_ALT_APP_URL = alt;
      try {
        expect(getInviteBaseUrl()).toBe("https://staging.thealliance.org");
      } finally {
        setEnv("VITE_API_URL", saved[0]);
        setEnv("VITE_ALT_APP_URL", saved[1]);
      }
    },
  );
});
