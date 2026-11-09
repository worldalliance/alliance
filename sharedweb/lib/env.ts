/// <reference types="vite/client" />
import { readEnvKey, requireEnvKey } from "@alliance/common/env";
import {
  type WebEnv,
  webEnvFields,
  type WebEnvKey,
} from "@alliance/common/web-env";

// Each key is read by name: passing `import.meta.env` whole makes Vite inline
// every value present at the build. The dev URLs, which the vite configs
// define in every mode, are read only in development so other builds drop them.
const dev = () => import.meta.env.MODE === "development";
const source = () =>
  ({
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_ALT_APP_URL: import.meta.env.VITE_ALT_APP_URL,
    VITE_PUBLIC_POSTHOG_KEY: import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
    VITE_PUBLIC_POSTHOG_HOST: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    VITE_APP_GIT_SHA: import.meta.env.VITE_APP_GIT_SHA,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
    ALLIANCE_DEV_API_URL: dev()
      ? import.meta.env.ALLIANCE_DEV_API_URL
      : undefined,
    ALLIANCE_DEV_APP_URL: dev()
      ? import.meta.env.ALLIANCE_DEV_APP_URL
      : undefined,
    ALLIANCE_DEV_ADMIN_URL: dev()
      ? import.meta.env.ALLIANCE_DEV_ADMIN_URL
      : undefined,
  }) satisfies Record<WebEnvKey, unknown>;

/** Reads `import.meta.env` on every call, so a value a test sets is seen. */
export function webEnv<K extends WebEnvKey>(key: K): WebEnv[K] {
  return readEnvKey({ fields: webEnvFields, key, source: source() });
}

/** For a key that is optional overall but required where it's called. */
export function requireWebEnv<K extends WebEnvKey>(
  key: K,
): NonNullable<WebEnv[K]> {
  return requireEnvKey({ fields: webEnvFields, key, source: source() });
}
