import { PostHog } from "posthog-node";
import { posthogClientIfEnabled } from "./posthog-client";

describe("posthogClientIfEnabled", () => {
  const nodeEnv = process.env.NODE_ENV;
  const apiKey = process.env.POSTHOG_KEY;

  beforeEach(() => {
    process.env.POSTHOG_KEY = "test-key";
  });

  afterEach(() => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (apiKey === undefined) delete process.env.POSTHOG_KEY;
    else process.env.POSTHOG_KEY = apiKey;
  });

  it("creates a client in production", async () => {
    process.env.NODE_ENV = "production";
    const client = posthogClientIfEnabled();
    expect(client).toBeInstanceOf(PostHog);
    await client?.shutdown();
  });

  it.each(["staging", "development", "test", "bogus", undefined])(
    "creates none when NODE_ENV is %s, even with a key",
    (env) => {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;
      expect(posthogClientIfEnabled()).toBeNull();
    },
  );
});
