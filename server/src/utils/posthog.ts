import {
  AnalyticsEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";
import type { EventMessage, PostHog } from "posthog-node";

/**
 * Typed wrapper around `posthog.capture` for the server (posthog-node).
 */
export function captureEvent(
  params: {
    client: Pick<PostHog, "capture">;
    event: AnalyticsEvent;
  } & Omit<EventMessage, "event">,
): void {
  const { client, ...message } = params;
  if (!message.properties) {
    message.properties = {};
  }
  message.properties[SLACK_PROPERTY] = SEND_TO_SLACK[message.event];
  client.capture(message);
}
