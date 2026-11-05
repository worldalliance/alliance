import { setEnv } from "@alliance/common/set-env";
import { PostHog } from "posthog-node";
import { posthogClientIfEnabled } from "./posthog-client";

describe("posthogClientIfEnabled", () => {
  const nodeEnv = process.env.NODE_ENV;
  const apiKey = process.env.POSTHOG_KEY;

  beforeEach(() => {
    process.env.POSTHOG_KEY = "test-key";
  });

  afterEach(() => {
    setEnv("NODE_ENV", nodeEnv);
    setEnv("POSTHOG_KEY", apiKey);
  });

  it("creates a client in production", async () => {
    process.env.NODE_ENV = "production";
    const client = posthogClientIfEnabled();
    expect(client).toBeInstanceOf(PostHog);
    await client?.shutdown();
  });

  it.each(["staging", "development", "test"])(
    "creates none when NODE_ENV is %s, even with a key",
    (env) => {
      process.env.NODE_ENV = env;
      expect(posthogClientIfEnabled()).toBeNull();
    },
  );
});
