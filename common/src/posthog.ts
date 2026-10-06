import { z } from "zod";

export const POSTHOG_SESSION_HEADER = "x-posthog-session-id";
export const POSTHOG_DISTINCT_HEADER = "x-posthog-distinct-id";

export const posthogContextSchema = z.object({
  sessionId: z.uuid().optional(),
  distinctId: z.string().min(1).max(200).optional(),
});

export type PosthogContext = z.infer<typeof posthogContextSchema>;
