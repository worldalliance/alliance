import { webEnv } from "./env";
import { webEnvironment } from "./runtimeConfig";

/** Super-properties that tag every PostHog event with the build that sent it. */
export const posthogBuildProperties = () => ({
  git_sha: webEnv("VITE_APP_GIT_SHA") ?? "unknown",
  environment: webEnvironment(),
});
