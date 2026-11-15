import { describe, expect, it } from "bun:test";
import { webRuntimeConfigSchema } from "./web-env";

describe("webRuntimeConfigSchema", () => {
  const staging = {
    environment: "staging",
    VITE_API_URL: "https://app.example.com",
    VITE_ALT_APP_URL: "https://alt.example.com",
    VITE_PUBLIC_POSTHOG_KEY: "phc_example",
    VITE_PUBLIC_POSTHOG_HOST: "https://app.example.com/events/",
  };

  it("accepts a complete deployed config", () => {
    expect(webRuntimeConfigSchema.safeParse(staging).success).toBe(true);
  });

  it.each([
    "VITE_API_URL",
    "VITE_ALT_APP_URL",
    "VITE_PUBLIC_POSTHOG_KEY",
    "VITE_PUBLIC_POSTHOG_HOST",
  ])("requires %s in a deployed config", (key) => {
    const parsed = webRuntimeConfigSchema.safeParse({
      ...staging,
      [key]: " ",
    });
    expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([[key]]);
  });

  it("rejects a scheme-less URL", () => {
    expect(
      webRuntimeConfigSchema.safeParse({
        ...staging,
        VITE_API_URL: "app.example.com",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown environment", () => {
    expect(
      webRuntimeConfigSchema.safeParse({ ...staging, environment: "prod" })
        .success,
    ).toBe(false);
  });

  it("lets development leave every value unset", () => {
    expect(
      webRuntimeConfigSchema.safeParse({ environment: "development" }).success,
    ).toBe(true);
  });
});
