import {
  POSTHOG_DISTINCT_HEADER,
  POSTHOG_SESSION_HEADER,
  posthogContextSchema,
  type PosthogContext,
} from "@alliance/common/posthog";
import type { Request } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  route?: string;
  handler?: string;
  userId?: number;
  posthog?: PosthogContext;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// Drops each malformed id on its own; they are optional telemetry.
function parsePosthogContext(input: {
  sessionId?: unknown;
  distinctId?: unknown;
}): PosthogContext {
  const { shape } = posthogContextSchema;
  const sessionId = shape.sessionId.safeParse(input.sessionId);
  const distinctId = shape.distinctId.safeParse(input.distinctId);
  return {
    sessionId: sessionId.success ? sessionId.data : undefined,
    distinctId: distinctId.success ? distinctId.data : undefined,
  };
}

export function createRequestContext(
  req: Pick<Request, "headers" | "method" | "originalUrl">,
): RequestContext {
  return {
    requestId: randomUUID(),
    method: req.method,
    url: req.originalUrl,
    posthog: parsePosthogContext({
      sessionId: req.headers[POSTHOG_SESSION_HEADER],
      distinctId: req.headers[POSTHOG_DISTINCT_HEADER],
    }),
  };
}

export function adoptPosthogContext(
  input: Parameters<typeof parsePosthogContext>[0],
): void {
  const store = requestContext.getStore();
  if (store) store.posthog = parsePosthogContext(input);
}
