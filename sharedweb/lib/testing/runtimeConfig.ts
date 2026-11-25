import { NodeEnv } from "@alliance/common/node-env";
import type { WebRuntimeConfig, WebRuntimeKey } from "@alliance/common/web-env";
import { setWebRuntimeConfig } from "../runtimeConfig";

/** Test-environment config with the API URL every non-development build has;
 * the preload resets to it before each test. */
export function setTestWebRuntimeConfig(
  overrides: Partial<Record<WebRuntimeKey, string>> = {},
): void {
  setWebRuntimeConfig({
    environment: NodeEnv.Test,
    VITE_API_URL: "https://alliance.test",
    ...overrides,
  });
}

export const deployedWebRuntimeConfig = (
  environment: NodeEnv.Staging | NodeEnv.Production,
) =>
  ({
    environment,
    VITE_API_URL: "https://app.example.com",
    VITE_ALT_APP_URL: "https://alt.example.com",
    VITE_PUBLIC_POSTHOG_KEY: "phc_example",
    VITE_PUBLIC_POSTHOG_HOST: "https://app.example.com/events/",
  }) satisfies WebRuntimeConfig;
