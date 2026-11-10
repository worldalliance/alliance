import { z } from "zod";
import { httpUrl, optionalEnv } from "./env";

export const webEnvFields = {
  VITE_API_URL: optionalEnv(httpUrl),
  VITE_ALT_APP_URL: optionalEnv(httpUrl),
  VITE_PUBLIC_POSTHOG_KEY: optionalEnv(z.string()),
  VITE_PUBLIC_POSTHOG_HOST: optionalEnv(httpUrl),
  VITE_APP_GIT_SHA: optionalEnv(z.string()),
  VITE_APP_VERSION: optionalEnv(z.string()),
  // The vite configs inject these from dev-ports.ts, outside the VITE_ prefix
  // so a `.env` file can't override them.
  ALLIANCE_DEV_API_URL: optionalEnv(httpUrl),
  ALLIANCE_DEV_APP_URL: optionalEnv(httpUrl),
  ALLIANCE_DEV_ADMIN_URL: optionalEnv(httpUrl),
};

export type WebEnvKey = keyof typeof webEnvFields;
export type WebEnv = z.output<z.ZodObject<typeof webEnvFields>>;
