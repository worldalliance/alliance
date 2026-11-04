import { describe, expect, it } from "bun:test";
import { validateWebEnv, webEnvPlugin } from "./web-env-build";

const deployed = {
  VITE_API_URL: "https://app.example.com",
  VITE_ALT_APP_URL: "https://alt.example.com",
};

const problems = (params: Parameters<typeof validateWebEnv>[0]) => {
  const result = validateWebEnv(params);
  return result.ok ? [] : result.error;
};

describe("validateWebEnv", () => {
  it("requires nothing in development", () => {
    expect(
      problems({ source: {}, mode: "development", deployedKeys: [] }),
    ).toEqual([]);
  });

  it("requires the API URL, which a test-mode bundle calls too", () => {
    expect(problems({ source: {}, mode: "test", deployedKeys: [] })).toEqual([
      "VITE_API_URL: missing",
    ]);
  });

  it("requires the API and alt URLs, plus the app's own keys, when deployed", () => {
    expect(
      problems({
        source: {},
        mode: "staging",
        deployedKeys: ["VITE_PUBLIC_POSTHOG_KEY"],
      }),
    ).toEqual([
      "VITE_API_URL: missing",
      "VITE_ALT_APP_URL: missing",
      "VITE_PUBLIC_POSTHOG_KEY: missing",
    ]);
    expect(
      problems({ source: deployed, mode: "production", deployedKeys: [] }),
    ).toEqual([]);
  });

  it("treats an empty value as missing and names a malformed one", () => {
    const found = problems({
      source: { ...deployed, VITE_ALT_APP_URL: "", VITE_API_URL: "nope" },
      mode: "production",
      deployedKeys: [],
    });
    expect(found).toHaveLength(2);
    expect(found[0]).toStartWith("VITE_API_URL: ");
    expect(found[0]).not.toEndWith("missing");
    expect(found[1]).toBe("VITE_ALT_APP_URL: missing");
  });

  it("rejects a mode that isn't a NODE_ENV, still naming malformed values", () => {
    expect(
      problems({ source: deployed, mode: "prod", deployedKeys: [] }),
    ).toEqual([
      'mode: "prod" is not one of production, staging, development, test',
    ]);
    const [, api, ...rest] = problems({
      source: { VITE_API_URL: "nope" },
      mode: "prod",
      deployedKeys: [],
    });
    expect(api).toStartWith("VITE_API_URL: ");
    expect(api).not.toEndWith("missing");
    expect(rest).toEqual([]);
  });

  it("ignores keys outside the schema, such as Vite's own flags", () => {
    expect(
      problems({
        source: { ...deployed, PROD: true, MODE: "production" },
        mode: "production",
        deployedKeys: [],
      }),
    ).toEqual([]);
  });
});

describe("webEnvPlugin", () => {
  const plugin = (env: Record<string, string>, mode: string) => {
    const built = webEnvPlugin(["VITE_PUBLIC_POSTHOG_KEY"]);
    built.configResolved({ mode, env });
    return built;
  };

  it("checks at build start, with the app's own keys", () => {
    expect(() => plugin(deployed, "production").buildStart()).toThrow(
      "Invalid environment for a production build:\n  VITE_PUBLIC_POSTHOG_KEY: missing",
    );
    expect(() =>
      plugin(
        { ...deployed, VITE_PUBLIC_POSTHOG_KEY: "phc" },
        "production",
      ).buildStart(),
    ).not.toThrow();
  });

  it("throws listing every problem", () => {
    expect(() => plugin({}, "staging").buildStart()).toThrow(
      "Invalid environment for a staging build:\n  VITE_API_URL: missing\n  VITE_ALT_APP_URL: missing\n  VITE_PUBLIC_POSTHOG_KEY: missing",
    );
  });

  it("checks nothing until a build starts", () => {
    expect(() => plugin({}, "production")).not.toThrow();
  });
});
