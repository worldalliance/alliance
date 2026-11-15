/// <reference types="vite/client" />
import { readEnvKey, requireEnvKey } from "@alliance/common/env";
import {
  type WebEnv,
  webEnvFields,
  type WebEnvKey,
  type WebRuntimeKey,
} from "@alliance/common/web-env";
import { webRuntimeConfig } from "./runtimeConfig";

// Each key is read by name: passing `import.meta.env` whole makes Vite inline
// every value present at the build. The dev URLs, which the vite configs
// define in every mode, are read only in development so other builds drop them.
const dev = () => import.meta.env.MODE === "development";
const buildSource = () =>
  ({
    VITE_APP_GIT_SHA: import.meta.env.VITE_APP_GIT_SHA,
    ALLIANCE_DEV_API_URL: dev()
      ? import.meta.env.ALLIANCE_DEV_API_URL
      : undefined,
    ALLIANCE_DEV_APP_URL: dev()
      ? import.meta.env.ALLIANCE_DEV_APP_URL
      : undefined,
    ALLIANCE_DEV_ADMIN_URL: dev()
      ? import.meta.env.ALLIANCE_DEV_ADMIN_URL
      : undefined,
  }) satisfies Record<Exclude<WebEnvKey, WebRuntimeKey>, unknown>;

const source = (key: WebEnvKey) => {
  const build = buildSource();
  return key in build ? build : webRuntimeConfig();
};

/** Reads on every call, so a value a test sets is seen. */
export function webEnv<K extends WebEnvKey>(key: K): WebEnv[K] {
  return readEnvKey({ fields: webEnvFields, key, source: source(key) });
}

/** For a key that is optional overall but required where it's called. */
export function requireWebEnv<K extends WebEnvKey>(
  key: K,
): NonNullable<WebEnv[K]> {
  return requireEnvKey({ fields: webEnvFields, key, source: source(key) });
}
