import { NodeEnv } from "@alliance/common/node-env";
import type { WebRuntimeKey } from "@alliance/common/web-env";
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
