import { NodeEnv } from "@alliance/common/node-env";
import { describe, expect, it } from "bun:test";
import { PostHog } from "posthog-js";
import { posthogOptions } from "./posthogOptions";

describe("posthogOptions", () => {
  it("drops app_version and tags events with the build and runtime environment once PostHog loads", () => {
    const posthog = new PostHog();
    posthog.init("phc_test", {
      ...posthogOptions,
      persistence: "memory",
      advanced_disable_flags: true,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      loaded: (loaded) => {
        loaded.register({ app_version: "old" });
        posthogOptions.loaded?.(loaded);
      },
    });
    expect(posthog.get_property("app_version")).toBeUndefined();
    expect(posthog.get_property("environment")).toBe(NodeEnv.Test);
    expect(posthog.get_property("git_sha")).toEqual(expect.any(String));
  });
});
