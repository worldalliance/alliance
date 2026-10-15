import { currentNodeEnv, NodeEnv } from "@alliance/common/node-env";
import { PostHog } from "posthog-node";

const POSTHOG_ENABLED: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: true,
  [NodeEnv.Staging]: false,
  [NodeEnv.Development]: false,
  [NodeEnv.Test]: false,
};

export function newPosthogClient(): PostHog {
  return new PostHog(process.env.POSTHOG_KEY!, {
    host: "https://us.i.posthog.com",
  });
}

export function posthogClientIfEnabled(): PostHog | null {
  const env = currentNodeEnv();
  if (!env.ok || !POSTHOG_ENABLED[env.value]) return null;
  return newPosthogClient();
}
