import { webEnvFields, type WebEnvKey } from "@alliance/common/web-env";
import { afterEach, describe, expect, it } from "bun:test";
import { requireWebEnv, webEnv } from "./env";

const saved = { ...process.env };

// Restored in place: under bun, import.meta.env is the original process.env.
afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) delete process.env[key];
  }
  Object.assign(process.env, saved);
});

describe("webEnv", () => {
  it("reads each key from its own variable", () => {
    process.env.MODE = "development";
    const keys = Object.keys(webEnvFields).filter(
      (key): key is WebEnvKey => key in webEnvFields,
    );
    const sample = (key: WebEnvKey) =>
      `https://${key.toLowerCase().replaceAll("_", "-")}.test`;
    for (const key of keys) process.env[key] = sample(key);
    for (const key of keys) expect(webEnv(key)).toBe(sample(key));
  });

  it("reads the dev URLs only in development", () => {
    process.env.ALLIANCE_DEV_API_URL = "http://localhost:1";
    process.env.MODE = "production";
    expect(webEnv("ALLIANCE_DEV_API_URL")).toBeUndefined();
    process.env.MODE = "development";
    expect(webEnv("ALLIANCE_DEV_API_URL")).toBe("http://localhost:1");
  });

  it("reads an empty value as unset", () => {
    process.env.VITE_API_URL = "";
    expect(webEnv("VITE_API_URL")).toBeUndefined();
  });
});

describe("requireWebEnv", () => {
  it("throws naming a missing key", () => {
    process.env.VITE_API_URL = "";
    expect(() => requireWebEnv("VITE_API_URL")).toThrow(
      "Invalid environment: VITE_API_URL: missing",
    );
  });

  it("throws naming a malformed key", () => {
    process.env.VITE_API_URL = "not a url";
    expect(() => requireWebEnv("VITE_API_URL")).toThrow(
      /^Invalid environment: VITE_API_URL: (?!missing)/,
    );
  });
});
