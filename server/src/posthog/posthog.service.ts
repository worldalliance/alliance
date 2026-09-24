import {
  AnalyticsEvent,
  ExceptionEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PostHog } from "posthog-node";
import { captureEvent } from "../utils/posthog";

/**
 * Singleton PostHog client for the server. Captures typed analytics events and
 * exceptions (the {@link captureEvent} wrapper stamps `send_to_slack` from the
 * shared `SEND_TO_SLACK` map). No-ops outside production so dev/test never emit.
 */
@Injectable()
export class PosthogService implements OnModuleDestroy {
  private readonly client: PostHog | null = null;

  constructor() {
    if (process.env.NODE_ENV !== "production") return;
    this.client = new PostHog(process.env.POSTHOG_KEY!, {
      host: "https://us.i.posthog.com",
    });
  }

  capture(params: {
    event: AnalyticsEvent;
    distinctId: string;
    properties?: Record<string, unknown>;
  }): void {
    const { event, distinctId, properties } = params;

    if (!this.client) return;
    captureEvent({ client: this.client, event, distinctId, properties });
  }

  captureException(params: {
    event: ExceptionEvent;
    error: Error;
    properties?: Record<string, unknown>;
  }): void {
    const { event, error, properties } = params;

    if (!this.client) return;
    this.client.captureException(error, "server", {
      event,
      [SLACK_PROPERTY]: SEND_TO_SLACK[event],
      properties: properties ?? {},
    });
  }

  identify(params: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): void {
    if (!this.client) return;
    this.client.identify(params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
  }
}
