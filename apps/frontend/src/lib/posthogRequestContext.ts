import type { PosthogContext } from "@alliance/common/posthog";
import { liveSessionId } from "@alliance/shared/lib/posthog-request";
import type { PostHog } from "posthog-js";

// posthog-js's persisted [lastActive, sessionId, started] tuple.
const STORED_SESSION_PROPERTY = "$sesid";

export function posthogRequestContext(
  posthog: Pick<
    PostHog,
    "__loaded" | "has_opted_out_capturing" | "get_distinct_id" | "get_property"
  > & { sessionManager?: { sessionTimeoutMs: number } },
): PosthogContext | undefined {
  if (!posthog.__loaded || posthog.has_opted_out_capturing()) return;
  const stored: unknown = posthog.get_property(STORED_SESSION_PROPERTY);
  const [lastActive, sessionId, started]: unknown[] = Array.isArray(stored)
    ? stored
    : [];
  const idleTimeoutMs = posthog.sessionManager?.sessionTimeoutMs;
  return {
    sessionId:
      idleTimeoutMs === undefined
        ? undefined
        : liveSessionId({ sessionId, lastActive, started, idleTimeoutMs }),
    distinctId: posthog.get_distinct_id(),
  };
}
