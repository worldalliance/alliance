import { posthogBuildProperties } from "@alliance/sharedweb/lib/posthogBuildProperties";
import type { PostHog, PostHogConfig } from "posthog-js";
import { registerArrival } from "./linkOpenings";

// Before PostHog has loaded it has no persistence, and both calls do nothing.
function tagBuild(posthog: Pick<PostHog, "register" | "unregister">) {
  // BACKCOMPAT(app-version): super-properties persist, so browsers that ran
  // an older build still send app_version. Remove a year after this reaches
  // production: events stop carrying it at once, so no query can tell when.
  posthog.unregister("app_version");
  posthog.register(posthogBuildProperties());
}

export const posthogOptions: Partial<PostHogConfig> = {
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
