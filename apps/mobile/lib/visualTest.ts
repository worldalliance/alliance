import { mobileEnv } from "./env";
const VISUAL_TEST_ENABLED = mobileEnv("EXPO_PUBLIC_VISUAL_TEST");

const DEFAULT_TEST_USER_EMAIL = "user15@example.com";
const DEFAULT_TEST_USER_PASSWORD = "Steadying3-Sacrament-Crave";

export const isVisualTestMode = VISUAL_TEST_ENABLED;

export const getVisualTestApiUrl = (): string | undefined => {
  return mobileEnv("EXPO_PUBLIC_VISUAL_TEST_API_URL");
};

export const getVisualTestAutoLoginCredentials = () => {
  if (!VISUAL_TEST_ENABLED) {
    return null;
  }

  return {
    email:
      mobileEnv("EXPO_PUBLIC_VISUAL_TEST_EMAIL") ?? DEFAULT_TEST_USER_EMAIL,
    password:
      mobileEnv("EXPO_PUBLIC_VISUAL_TEST_PASSWORD") ??
      DEFAULT_TEST_USER_PASSWORD,
  };
};
