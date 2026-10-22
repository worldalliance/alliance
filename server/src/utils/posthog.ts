import {
  AnalyticsEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";
import type { EventMessage, PostHog } from "posthog-node";
import { requestContext } from "./request-context";

function sessionProperties() {
  const sessionId = requestContext.getStore()?.posthog?.sessionId;
  return sessionId ? { $session_id: sessionId } : {};
}

// A client-supplied distinct id is unauthenticated, so it gets no person profile.
function contextIdentity() {
  const ctx = requestContext.getStore();
  if (ctx?.userId !== undefined) {
    return { distinctId: ctx.userId.toString(), properties: {} };
  }
  if (ctx?.posthog?.distinctId) {
    return {
      distinctId: ctx.posthog.distinctId,
      properties: { $process_person_profile: false },
    };
  }
  return { distinctId: "server", properties: {} };
}

/**
 * Typed wrapper around `posthog.capture` for the server (posthog-node).
 */
export function captureEvent(
  params: {
    client: Pick<PostHog, "capture">;
    event: AnalyticsEvent;
    distinctId?: string;
  } & Omit<EventMessage, "event" | "distinctId">,
): void {
  const { client, ...message } = params;
  const identity = message.distinctId
    ? { distinctId: message.distinctId, properties: {} }
    : contextIdentity();
  client.capture({
    ...message,
    distinctId: identity.distinctId,
    properties: {
      ...message.properties,
      ...identity.properties,
      ...sessionProperties(),
      [SLACK_PROPERTY]: SEND_TO_SLACK[message.event],
    },
  });
}

export function captureException(params: {
  client: Pick<PostHog, "captureException">;
  error: unknown;
  properties?: Record<string, unknown>;
}): void {
  const identity = contextIdentity();
  params.client.captureException(params.error, identity.distinctId, {
    ...params.properties,
    ...identity.properties,
    ...sessionProperties(),
  });
}
