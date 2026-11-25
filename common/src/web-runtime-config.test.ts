import { afterEach, describe, expect, it, jest } from "bun:test";
import * as deployedConfigModule from "./deployed-config";
import { deployedConfigFor } from "./deployed-config";
import { NodeEnv } from "./node-env";
import { webRuntimeConfigFor } from "./web-runtime-config";

afterEach(() => jest.restoreAllMocks());

describe("webRuntimeConfigFor", () => {
  it.each([NodeEnv.Staging, NodeEnv.Production])(
    "builds %s's config from its committed values",
    (environment) => {
      const config = deployedConfigFor(environment);
      expect(webRuntimeConfigFor(environment)).toEqual({
        ok: true,
        value: {
          environment,
          VITE_API_URL: `https://${config.DOMAIN_NAME}`,
          VITE_ALT_APP_URL: `https://${config.ALT_DOMAIN_NAME}`,
          VITE_PUBLIC_POSTHOG_KEY: config.POSTHOG_KEY,
          VITE_PUBLIC_POSTHOG_HOST: `https://${config.DOMAIN_NAME}/events/`,
        },
      });
    },
  );

  it("lists every committed value the schema rejects", () => {
    const staging = deployedConfigFor(NodeEnv.Staging);
    jest.spyOn(deployedConfigModule, "deployedConfigFor").mockReturnValue({
      ...staging,
      ALT_DOMAIN_NAME: "",
      POSTHOG_KEY: " ",
    });
    expect(webRuntimeConfigFor("staging")).toEqual({
      ok: false,
      error: [
        expect.stringMatching(/^VITE_ALT_APP_URL: /),
        expect.stringMatching(/^VITE_PUBLIC_POSTHOG_KEY: /),
      ],
    });
  });

  it("carries only the environment in development and test", () => {
    expect(webRuntimeConfigFor("development")).toEqual({
      ok: true,
      value: { environment: NodeEnv.Development },
    });
    expect(webRuntimeConfigFor("test")).toEqual({
      ok: true,
      value: { environment: NodeEnv.Test },
    });
  });

  it("rejects a mode that isn't a NODE_ENV", () => {
    expect(webRuntimeConfigFor("prod")).toEqual({
      ok: false,
      error: [
        "NODE_ENV=prod (expected one of production, staging, development, test)",
      ],
    });
    expect(webRuntimeConfigFor(undefined).ok).toBe(false);
  });
});
