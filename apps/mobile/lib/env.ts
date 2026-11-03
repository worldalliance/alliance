import {
  envFlag,
  httpUrl,
  optionalEnv,
  readEnvKey,
} from "@alliance/common/env";
import { z } from "zod";

const fields = {
  EXPO_PUBLIC_ALLIANCE_API_PORT: optionalEnv(
    z.coerce.number().int().min(1).max(65535),
  ),
  EXPO_PUBLIC_DEV_API_URL: optionalEnv(z.string()),
  EXPO_PUBLIC_GIT_COMMIT: optionalEnv(z.string()),
  EXPO_PUBLIC_DEV_AUTO_LOGIN: envFlag,
  EXPO_PUBLIC_DEV_EMAIL: optionalEnv(z.string()),
  EXPO_PUBLIC_DEV_PASSWORD: optionalEnv(z.string()),
  EXPO_PUBLIC_VISUAL_TEST: envFlag,
  EXPO_PUBLIC_VISUAL_TEST_API_URL: optionalEnv(httpUrl),
  EXPO_PUBLIC_VISUAL_TEST_EMAIL: optionalEnv(z.string()),
  EXPO_PUBLIC_VISUAL_TEST_PASSWORD: optionalEnv(z.string()),
};

export type MobileEnvKey = keyof typeof fields;

// Metro inlines `process.env.EXPO_PUBLIC_*` only where it's written out, so
// every key is read by name.
const source = () =>
  ({
    EXPO_PUBLIC_ALLIANCE_API_PORT: process.env.EXPO_PUBLIC_ALLIANCE_API_PORT,
    EXPO_PUBLIC_DEV_API_URL: process.env.EXPO_PUBLIC_DEV_API_URL,
    EXPO_PUBLIC_GIT_COMMIT: process.env.EXPO_PUBLIC_GIT_COMMIT,
    EXPO_PUBLIC_DEV_AUTO_LOGIN: process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN,
    // Behind __DEV__ so a release build's constant folding drops the
    // credentials.
    EXPO_PUBLIC_DEV_EMAIL: __DEV__
      ? process.env.EXPO_PUBLIC_DEV_EMAIL
      : undefined,
    EXPO_PUBLIC_DEV_PASSWORD: __DEV__
      ? process.env.EXPO_PUBLIC_DEV_PASSWORD
      : undefined,
    EXPO_PUBLIC_VISUAL_TEST: process.env.EXPO_PUBLIC_VISUAL_TEST,
    EXPO_PUBLIC_VISUAL_TEST_API_URL:
      process.env.EXPO_PUBLIC_VISUAL_TEST_API_URL,
    EXPO_PUBLIC_VISUAL_TEST_EMAIL: process.env.EXPO_PUBLIC_VISUAL_TEST_EMAIL,
    EXPO_PUBLIC_VISUAL_TEST_PASSWORD:
      process.env.EXPO_PUBLIC_VISUAL_TEST_PASSWORD,
  }) satisfies Record<MobileEnvKey, string | undefined>;

/** Reads `process.env` on every call, so a value a test sets is seen. */
export function mobileEnv<K extends MobileEnvKey>(
  key: K,
): z.output<(typeof fields)[K]> {
  return readEnvKey({ fields, key, source: source() });
}
