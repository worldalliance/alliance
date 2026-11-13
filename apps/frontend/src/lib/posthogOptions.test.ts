import { describe, expect, it } from "bun:test";
import { PostHog } from "posthog-js";
import { posthogOptions } from "./posthogOptions";

describe("posthogOptions", () => {
  it("tags events with the build once PostHog loads", () => {
    const posthog = new PostHog();
    posthog.init("phc_test", {
      ...posthogOptions,
      persistence: "memory",
      advanced_disable_flags: true,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
    });
    expect(posthog.get_property("git_sha")).toEqual(expect.any(String));
    expect(posthog.get_property("app_version")).toEqual(expect.any(String));
  });
});
