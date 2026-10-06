import type { PosthogContext } from "@alliance/common/posthog";
import { liveSessionId } from "@alliance/shared/lib/posthog-request";
import { PostHogPersistedProperty } from "@posthog/core";
import { minutesToSeconds, secondsToMilliseconds } from "date-fns";
import type { PostHog } from "posthog-react-native";

export const SESSION_IDLE_TIMEOUT_SECONDS = minutesToSeconds(30);

export function posthogRequestContext(
  posthog: Pick<PostHog, "optedOut" | "getDistinctId"> & {
    getPersistedProperty(key: PostHogPersistedProperty): unknown;
  },
): PosthogContext | undefined {
  if (posthog.optedOut) return;
  return {
    sessionId: liveSessionId({
      sessionId: posthog.getPersistedProperty(
        PostHogPersistedProperty.SessionId,
      ),
      lastActive: posthog.getPersistedProperty(
        PostHogPersistedProperty.SessionLastTimestamp,
      ),
      started: posthog.getPersistedProperty(
        PostHogPersistedProperty.SessionStartTimestamp,
      ),
      idleTimeoutMs: secondsToMilliseconds(SESSION_IDLE_TIMEOUT_SECONDS),
    }),
    distinctId: posthog.getDistinctId(),
  };
}
