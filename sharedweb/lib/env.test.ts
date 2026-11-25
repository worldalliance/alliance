import { setEnv } from "@alliance/common/set-env";
import { afterEach, describe, expect, it } from "bun:test";
import { requireWebEnv, webEnv } from "./env";
import { setTestWebRuntimeConfig } from "./testing/runtimeConfig";

const saved = { ...process.env };

// Restored in place: under bun, import.meta.env is the original process.env.
afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(saved)) setEnv(key, value);
});

describe("webEnv", () => {
  it("reads the runtime keys from the runtime config", () => {
    process.env.VITE_ALT_APP_URL = "https://build.test";
    setTestWebRuntimeConfig({ VITE_ALT_APP_URL: "https://runtime.test" });
    expect(webEnv("VITE_ALT_APP_URL")).toBe("https://runtime.test");
  });

  it("reads the git sha from the build", () => {
    process.env.VITE_APP_GIT_SHA = "deadbeef";
    expect(webEnv("VITE_APP_GIT_SHA")).toBe("deadbeef");
  });

  it("reads the dev URLs only in development", () => {
    process.env.ALLIANCE_DEV_API_URL = "http://localhost:1";
    process.env.MODE = "production";
    expect(webEnv("ALLIANCE_DEV_API_URL")).toBeUndefined();
    process.env.MODE = "development";
    expect(webEnv("ALLIANCE_DEV_API_URL")).toBe("http://localhost:1");
  });

  it("reads an empty value as unset", () => {
    setTestWebRuntimeConfig({ VITE_API_URL: "" });
    expect(webEnv("VITE_API_URL")).toBeUndefined();
  });
});

describe("requireWebEnv", () => {
  it("throws naming a missing key", () => {
    setTestWebRuntimeConfig({ VITE_API_URL: "" });
    expect(() => requireWebEnv("VITE_API_URL")).toThrow(
      "Invalid environment: VITE_API_URL: missing",
    );
  });

  it("throws naming a malformed key", () => {
    setTestWebRuntimeConfig({ VITE_API_URL: "not a url" });
    expect(() => requireWebEnv("VITE_API_URL")).toThrow(
      /^Invalid environment: VITE_API_URL: (?!missing)/,
    );
  });
});
