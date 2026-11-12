import {
  ForbiddenException,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { milliseconds } from "date-fns";
import type { Request } from "express";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { validateRequest } from "twilio/lib/webhooks/webhooks";
import { env, requireEnv, twilioSignatureEnforcedFor } from "../config/env";

export function twilioSignatureEnforced(): boolean {
  return twilioSignatureEnforcedFor(env("NODE_ENV"));
}

/** Public path; nginx strips `/api` before the request reaches Nest. */
const TWILIO_WEBHOOK_PATH = "/api/mms/inbound";

/** Builds the public URL from `APP_URL`, ignoring proxy-altered request data. */
export function twilioWebhookUrl(): string {
  return new URL(TWILIO_WEBHOOK_PATH, requireEnv("APP_URL")).toString();
}

/**
 * {@link twilioWebhookUrl} and its `ALT_APP_URL` counterpart, since `APP_URL`
 * and the Twilio console change domain at different moments.
 *
 * BACKCOMPAT(twilio-legacy-url): accepting the worldalliance.org URL goes once
 * the Twilio console points at thealliance.org and every deployed
 * environment's `APP_URL` is thealliance.org (ALL-2151).
 */
export function twilioWebhookUrls(): string[] {
  const alt = env("ALT_APP_URL");
  return [
    twilioWebhookUrl(),
    ...(alt ? [new URL(TWILIO_WEBHOOK_PATH, alt).toString()] : []),
  ];
}

const ALERT_INTERVAL_MS = milliseconds({ minutes: 15 });

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);

  private rejectionsSinceAlert = 0;
  private lastAlertAt: number | null = null;

  constructor(private readonly eventLogService: EventLogService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!twilioSignatureEnforced()) {
      return true;
    }

    const authToken = requireEnv("TWILIO_AUTH_TOKEN");
    const urls = twilioWebhookUrls();

    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.header("X-Twilio-Signature");
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (
      !signature ||
      !urls.some((url) => validateRequest(authToken, signature, url, body))
    ) {
      this.logger.warn(
        `Rejected inbound Twilio webhook: signature did not match for ${urls.join(" or ")}`,
      );
      this.alert({ urls, hadSignature: Boolean(signature) });
      throw new ForbiddenException();
    }

    return true;
  }

  /** Sends rate-limited rejection alerts without delaying the response. */
  private alert(params: { urls: string[]; hadSignature: boolean }): void {
    this.rejectionsSinceAlert++;

    const now = Date.now();
    if (
      this.lastAlertAt !== null &&
      now - this.lastAlertAt < ALERT_INTERVAL_MS
    ) {
      return;
    }

    const rejections = this.rejectionsSinceAlert;
    this.lastAlertAt = now;
    this.rejectionsSinceAlert = 0;

    const since =
      rejections === 1
        ? ""
        : ` (${rejections} rejections since the last alert)`;
    void this.eventLogService.sendMessage({
      type: EventType.SmsFailure,
      message:
        `Inbound Twilio webhook rejected: signature did not match${since}. ` +
        "No STOP or START from a member is being honoured while this continues — " +
        "check that the webhook URL in the Twilio console is exactly " +
        `${params.urls.join(" or ")}.`,
      blob: { ...params, rejectionsSinceLastAlert: rejections },
      userId: null,
    });
  }
}
