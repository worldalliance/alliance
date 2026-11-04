import { webEnv } from "@alliance/sharedweb/lib/env";
import { posthog } from "posthog-js";
import { useEffect } from "react";

function PosthogBuildTag() {
  useEffect(() => {
    posthog.register({
      git_sha: webEnv("VITE_APP_GIT_SHA") ?? "unknown",
      app_version: webEnv("VITE_APP_VERSION") ?? "unknown",
    });
  }, []);
  return null;
}

export default PosthogBuildTag;
