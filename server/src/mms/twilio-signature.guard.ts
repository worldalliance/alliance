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
import { SmsFailureKind } from "src/eventlog/event-messages";
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
    const url = twilioWebhookUrl();

    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.header("X-Twilio-Signature");
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!signature || !validateRequest(authToken, signature, url, body)) {
      this.logger.warn(
        `Rejected inbound Twilio webhook: signature did not match for ${url}`,
      );
      this.alert({ url, hadSignature: Boolean(signature) });
      throw new ForbiddenException();
    }

    return true;
  }

  /** Sends rate-limited rejection alerts without delaying the response. */
  private alert(params: { url: string; hadSignature: boolean }): void {
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

    void this.eventLogService.sendMessage({
      type: EventType.SmsFailure,
      payload: {
        kind: SmsFailureKind.SignatureRejected,
        webhookUrl: params.url,
        rejections,
      },
      blob: { ...params, rejectionsSinceLastAlert: rejections },
      userId: null,
    });
  }
}
