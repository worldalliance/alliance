import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { deployedConfigFor } from "./deployed-config";
import { NodeEnv } from "./node-env";
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
    expect(problems({ source: {}, mode: "development" })).toEqual([]);
  });

  it("requires the API URL, which a test-mode bundle calls too", () => {
    expect(problems({ source: {}, mode: "test" })).toEqual([
      "VITE_API_URL: missing",
    ]);
  });

  it("takes deployed builds' required values from the committed config", () => {
    for (const mode of [NodeEnv.Staging, NodeEnv.Production] as const) {
      const result = validateWebEnv({ source: {}, mode });
      expect(result.ok && result.value.VITE_PUBLIC_POSTHOG_KEY).toBe(
        deployedConfigFor(mode).POSTHOG_KEY,
      );
    }
  });

  it("names a set malformed value over the committed one", () => {
    const found = problems({
      source: { VITE_API_URL: "nope" },
      mode: "production",
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toStartWith("VITE_API_URL: ");
    expect(found[0]).not.toEndWith("missing");
  });

  it("treats an empty value as missing", () => {
    expect(problems({ source: { VITE_API_URL: "" }, mode: "test" })).toEqual([
      "VITE_API_URL: missing",
    ]);
  });

  it("rejects a mode that isn't a NODE_ENV, still naming malformed values", () => {
    expect(problems({ source: deployed, mode: "prod" })).toEqual([
      'mode: "prod" is not one of production, staging, development, test',
    ]);
    const [, api, ...rest] = problems({
      source: { VITE_API_URL: "nope" },
      mode: "prod",
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
      }),
    ).toEqual([]);
  });
});

describe("webEnvPlugin", () => {
  const plugin = (env: Record<string, string>, mode: string) => {
    const built = webEnvPlugin();
    built.configResolved({ mode, env });
    return built;
  };

  describe("config", () => {
    const keys = [
      "VITE_API_URL",
      "VITE_ALT_APP_URL",
      "VITE_PUBLIC_POSTHOG_KEY",
      "VITE_PUBLIC_POSTHOG_HOST",
    ];
    const saved = keys.map((key) => [key, process.env[key]] as const);
    beforeEach(() => {
      for (const key of keys) delete process.env[key];
    });
    afterEach(() => {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    const define = (mode: string) =>
      webEnvPlugin().config({ envDir: import.meta.dir }, { mode }).define;

    it("defines a deployed build's four web values from its own committed config", () => {
      const config = deployedConfigFor(NodeEnv.Staging);
      expect(define("staging")).toEqual({
        "import.meta.env.VITE_API_URL": JSON.stringify(
          `https://${config.DOMAIN_NAME}`,
        ),
        "import.meta.env.VITE_ALT_APP_URL": JSON.stringify(
          `https://${config.ALT_DOMAIN_NAME}`,
        ),
        "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": JSON.stringify(
          config.POSTHOG_KEY,
        ),
        "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": JSON.stringify(
          `https://${config.DOMAIN_NAME}/events/`,
        ),
      });
    });

    it("lets a set value override the committed one, and a blank fall through", () => {
      process.env.VITE_API_URL = "https://override.example.com";
      expect(define("production")?.["import.meta.env.VITE_API_URL"]).toBe(
        JSON.stringify("https://override.example.com"),
      );
      process.env.VITE_API_URL = "";
      expect(define("production")?.["import.meta.env.VITE_API_URL"]).toBe(
        JSON.stringify(
          `https://${deployedConfigFor(NodeEnv.Production).DOMAIN_NAME}`,
        ),
      );
    });

    it("defines nothing outside a deployed build", () => {
      expect(define("development")).toEqual({});
      expect(define("test")).toEqual({});
    });
  });

  it("checks at build start", () => {
    expect(() => plugin({}, "test").buildStart()).toThrow(
      "Invalid environment for a test build:\n  VITE_API_URL: missing",
    );
    expect(() => plugin({}, "production").buildStart()).not.toThrow();
  });

  it("throws listing every problem", () => {
    expect(() =>
      plugin(
        { VITE_API_URL: "nope", VITE_PUBLIC_POSTHOG_HOST: "nope" },
        "staging",
      ).buildStart(),
    ).toThrow(
      /staging build:\n {2}VITE_API_URL: .*\n {2}VITE_PUBLIC_POSTHOG_HOST: /,
    );
  });

  it("checks nothing until a build starts", () => {
    expect(() => plugin({}, "test")).not.toThrow();
  });
});
