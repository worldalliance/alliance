import { NodeEnv } from "@alliance/common/node-env";
import { PostHog } from "posthog-node";
import { env, requireEnv } from "../config/env";

const POSTHOG_ENABLED: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: true,
  [NodeEnv.Staging]: false,
  [NodeEnv.Development]: false,
  [NodeEnv.Test]: false,
};

export function newPosthogClient(): PostHog {
  return new PostHog(requireEnv("POSTHOG_KEY"), {
    host: "https://us.i.posthog.com",
  });
}

export function posthogClientIfEnabled(): PostHog | null {
  if (!POSTHOG_ENABLED[env("NODE_ENV")]) return null;
  return newPosthogClient();
}
