import { AnalyticsEvent } from "@alliance/common/analytics";
import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import crypto from "crypto";
import { PostHog } from "posthog-node";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { captureEvent } from "../utils/posthog";
import type { MailgunWebhookBody } from "./mailgun";

function verifyMailgunSignature(sig: {
  timestamp: string;
  token: string;
  signature: string;
}) {
  const hmac = crypto
    .createHmac("sha256", process.env.MAILGUN_SIGNING_KEY!)
    .update(sig.timestamp + sig.token)
    .digest("hex");

  const withinWindow =
    Math.abs(Date.now() / 1000 - Number(sig.timestamp)) < 600; // 10 minutes
  return (
    withinWindow &&
    crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig.signature))
  );
}

function toPostHogEvent(event: string): AnalyticsEvent | string {
  switch (event) {
    case "delivered":
      return AnalyticsEvent.EmailDelivered;
    case "opened":
      return AnalyticsEvent.EmailOpened;
    case "clicked":
      return AnalyticsEvent.EmailClicked;
    case "bounced":
      return AnalyticsEvent.EmailBounced;
    case "complained":
      return AnalyticsEvent.EmailComplained;
    case "unsubscribed":
      return AnalyticsEvent.EmailUnsubscribed;
    default:
      return `email${event}`;
  }
}

@Controller("/mailgun")
export class MailgunWebhookController {
  private readonly posthog: PostHog;
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    if (process.env.NODE_ENV === "test") return;
    this.posthog = new PostHog(process.env.POSTHOG_KEY!, {
      host: "https://us.i.posthog.com",
    });
  }

  @Post("/handle-event")
  @ApiOkResponse()
  async handle(@Body() body: MailgunWebhookBody): Promise<void> {
    if (process.env.NODE_ENV === "test") return;

    if (!body?.signature || !verifyMailgunSignature(body.signature)) {
      throw new BadRequestException("invalid signature");
    }

    const e = body["event-data"];
    const event = toPostHogEvent(e.event);
    const email = e.recipient ?? "unknown";
    const phTimestamp = e.timestamp ? new Date(e.timestamp * 1000) : undefined;

    const user = await this.userRepository.findOneBy({ email });
    const distinctId = user?.id.toString() ?? email;

    const isProduction = e.tags?.includes("production");
    if (!isProduction) {
      return;
    }

    const properties = {
      recipient: email,
      timestamp: phTimestamp,
      subject: e.message?.headers?.subject,
      mailgunId: e.id,
      headers: e.message?.headers,
      messageId: e.message?.headers?.["message-id"],
    };

    captureEvent({
      client: this.posthog,
      event: event as AnalyticsEvent,
      distinctId,
      properties,
    });

    await this.posthog.flush();
  }
}
