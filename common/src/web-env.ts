import { z } from "zod";
import { httpUrl, optionalEnv } from "./env";
import { NodeEnv } from "./node-env";

export const webEnvFields = {
  VITE_API_URL: optionalEnv(httpUrl),
  VITE_ALT_APP_URL: optionalEnv(httpUrl),
  VITE_PUBLIC_POSTHOG_KEY: optionalEnv(z.string()),
  VITE_PUBLIC_POSTHOG_HOST: optionalEnv(httpUrl),
  VITE_APP_GIT_SHA: optionalEnv(z.string()),
  // The vite configs inject these from dev-ports.ts, outside the VITE_ prefix
  // so a `.env` file can't override them.
  ALLIANCE_DEV_API_URL: optionalEnv(httpUrl),
  ALLIANCE_DEV_APP_URL: optionalEnv(httpUrl),
  ALLIANCE_DEV_ADMIN_URL: optionalEnv(httpUrl),
};

export type WebEnvKey = keyof typeof webEnvFields;
export type WebEnv = z.output<z.ZodObject<typeof webEnvFields>>;

export const webRuntimeConfigSchema = z.discriminatedUnion("environment", [
  z.object({
    environment: z.enum([NodeEnv.Staging, NodeEnv.Production]),
    VITE_API_URL: httpUrl,
    VITE_ALT_APP_URL: httpUrl,
    VITE_PUBLIC_POSTHOG_KEY: z.string().trim().min(1),
    VITE_PUBLIC_POSTHOG_HOST: httpUrl,
  }),
  z.object({
    environment: z.enum([NodeEnv.Development, NodeEnv.Test]),
    VITE_API_URL: webEnvFields.VITE_API_URL,
    VITE_ALT_APP_URL: webEnvFields.VITE_ALT_APP_URL,
    VITE_PUBLIC_POSTHOG_KEY: webEnvFields.VITE_PUBLIC_POSTHOG_KEY,
    VITE_PUBLIC_POSTHOG_HOST: webEnvFields.VITE_PUBLIC_POSTHOG_HOST,
  }),
]);

export type WebRuntimeConfig = z.output<typeof webRuntimeConfigSchema>;
export type WebRuntimeKey = Exclude<keyof WebRuntimeConfig, "environment">;

// Fails to compile once a NodeEnv is in neither branch above.
const _everyEnvironment: Record<
  Exclude<NodeEnv, WebRuntimeConfig["environment"]>,
  never
> = {};
