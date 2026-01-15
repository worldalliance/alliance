import { posthog } from "posthog-js";
import { useEffect } from "react";

function PosthogBuildTag() {
  useEffect(() => {
    posthog.register({
      git_sha: import.meta.env.VITE_APP_GIT_SHA ?? "unknown",
      app_version: import.meta.env.VITE_APP_VERSION ?? "unknown",
    });
  }, []);
  return null;
}

export default PosthogBuildTag;
