const VISUAL_TEST_ENABLED = process.env.EXPO_PUBLIC_VISUAL_TEST === "true";

const DEFAULT_TEST_USER_EMAIL = "user15@example.com";
const DEFAULT_TEST_USER_PASSWORD = "Steadying3-Sacrament-Crave";

export const isVisualTestMode = VISUAL_TEST_ENABLED;

export const getVisualTestApiUrl = (): string | undefined => {
  return process.env.EXPO_PUBLIC_VISUAL_TEST_API_URL || undefined;
};

export const getVisualTestAutoLoginCredentials = () => {
  if (!VISUAL_TEST_ENABLED) {
    return null;
  }

  return {
    email: process.env.EXPO_PUBLIC_VISUAL_TEST_EMAIL ?? DEFAULT_TEST_USER_EMAIL,
    password:
      process.env.EXPO_PUBLIC_VISUAL_TEST_PASSWORD ??
      DEFAULT_TEST_USER_PASSWORD,
  };
};
