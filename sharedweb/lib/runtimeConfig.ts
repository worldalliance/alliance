import type { NodeEnv } from "@alliance/common/node-env";
import type { WebRuntimeConfig } from "@alliance/common/web-env";

let loaded: WebRuntimeConfig | undefined;

export function setWebRuntimeConfig(config: WebRuntimeConfig): void {
  loaded = config;
}

export function clearWebRuntimeConfig(): void {
  loaded = undefined;
}

export function webRuntimeConfig(): WebRuntimeConfig {
  if (!loaded) {
    throw new Error("The web runtime config was read before the app loaded it");
  }
  return loaded;
}

export const webEnvironment = (): NodeEnv => webRuntimeConfig().environment;
