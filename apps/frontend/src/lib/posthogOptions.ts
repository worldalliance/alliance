import { webEnv } from "@alliance/sharedweb/lib/env";
import type { PostHog, PostHogConfig } from "posthog-js";
import { getPosthogHost } from "./config";
import { registerArrival } from "./linkOpenings";

// Before PostHog has loaded it has no persistence, and register does nothing.
function tagBuild(posthog: Pick<PostHog, "register">) {
  posthog.register({
    git_sha: webEnv("VITE_APP_GIT_SHA") ?? "unknown",
    app_version: webEnv("VITE_APP_VERSION") ?? "unknown",
  });
}

export const posthogOptions: Partial<PostHogConfig> = {
  api_host: getPosthogHost(),
  loaded: (instance) => {
    tagBuild(instance);
    registerArrival(instance);
  },
  defaults: "2025-05-24",
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: true,
  },
  session_recording: {
    maskAllInputs: false,
    maskInputFn: (text, element) => {
      if (element?.nodeName === "TEXTAREA") {
        return text;
      }
      return "*".repeat(text.length);
    },
    maskCapturedNetworkRequestFn: (request) => {
      if (request.name.includes("auth")) {
        request.requestBody = undefined;
        return request;
      }
      return request;
    },
  },
};
