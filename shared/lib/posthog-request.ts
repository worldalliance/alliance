import {
  POSTHOG_DISTINCT_HEADER,
  POSTHOG_SESSION_HEADER,
  type PosthogContext,
} from "@alliance/common/posthog";
import { R } from "@alliance/common/result";
import type { Client } from "@hey-api/client-fetch";
import { hoursToMilliseconds } from "date-fns";

const SESSION_MAX_LENGTH_MS = hoursToMilliseconds(24);

// Reads a session the SDK stored, without the SDK's own getters: those count
// as activity or start a new session. Past these limits the SDK rotates the
// session on its next event, so the stored id is already dead.
export function liveSessionId(stored: {
  sessionId: unknown;
  lastActive: unknown;
  started: unknown;
  idleTimeoutMs: number;
}): string | undefined {
  const { sessionId, lastActive, started } = stored;
  if (
    typeof sessionId !== "string" ||
    typeof lastActive !== "number" ||
    typeof started !== "number"
  )
    return;
  const now = Date.now();
  if (
    now - lastActive > stored.idleTimeoutMs ||
    now - started > SESSION_MAX_LENGTH_MS
  )
    return;
  return sessionId;
}

export function registerPosthogRequestContext(params: {
  client: Client;
  getContext: () => PosthogContext | undefined;
}): () => void {
  const interceptor = params.client.interceptors.request.use((request) => {
    const result = R.fromThrowable(params.getContext);
    if (!result.ok) {
      console.warn("[analytics] Request context unavailable", result.error);
      return request;
    }
    const context = result.value;
    if (context?.sessionId)
      request.headers.set(POSTHOG_SESSION_HEADER, context.sessionId);
    if (context?.distinctId)
      request.headers.set(POSTHOG_DISTINCT_HEADER, context.distinctId);
    return request;
  });
  return () => params.client.interceptors.request.eject(interceptor);
}
