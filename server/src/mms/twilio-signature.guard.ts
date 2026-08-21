import { R, type Result } from "@alliance/common/result";
import {
  ForbiddenException,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { validateRequest } from "twilio/lib/webhooks/webhooks";

const UNVERIFIED_ENVS: ReadonlySet<string> = new Set(["test", "development"]);

/** Keeps startup validation aligned with guard policy. */
export function twilioSignatureEnforced(): boolean {
  return !UNVERIFIED_ENVS.has(process.env.NODE_ENV ?? "");
}

/** Public path; nginx strips `/api` before the request reaches Nest. */
const TWILIO_WEBHOOK_PATH = "/api/mms/inbound";

/** Builds the public URL from `APP_URL`, ignoring proxy-altered request data. */
export function twilioWebhookUrl(): Result<string, Error> {
  return R.map(
    R.fromThrowable(() => new URL(TWILIO_WEBHOOK_PATH, process.env.APP_URL)),
    (url) => url.toString(),
  );
}

const ALERT_INTERVAL_MS = 15 * 60 * 1000;

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

    const webhookUrl = twilioWebhookUrl();
    const expectedUrl = R.toNullable(webhookUrl);

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      this.logger.error(
        "TWILIO_AUTH_TOKEN is not set; rejecting inbound Twilio webhook",
      );
      this.alert("TWILIO_AUTH_TOKEN is not set", expectedUrl, {});
      throw new ForbiddenException();
    }

    if (R.isFailure(webhookUrl)) {
      const appUrl = process.env.APP_URL ?? "unset";
      this.logger.error(
        `APP_URL is not a usable base URL (${appUrl}); rejecting inbound Twilio webhook`,
      );
      this.alert(`APP_URL is not a usable base URL (${appUrl})`, expectedUrl, {
        appUrl,
      });
      throw new ForbiddenException();
    }
    const url = webhookUrl.value;

    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.header("X-Twilio-Signature");

    if (
      !signature ||
      !validateRequest(
        authToken,
        signature,
        url,
        (req.body ?? {}) as Record<string, unknown>,
      )
    ) {
      this.logger.warn(
        `Rejected inbound Twilio webhook: signature did not match for ${url}`,
      );
      this.alert(`signature did not match for ${url}`, url, {
        url,
        hadSignature: Boolean(signature),
      });
      throw new ForbiddenException();
    }

    return true;
  }

  /** Sends rate-limited rejection alerts without delaying the response. */
  private alert(
    reason: string,
    expectedUrl: string | null,
    blob: Record<string, unknown>,
  ): void {
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
        `Inbound Twilio webhook rejected: ${reason}${since}. ` +
        "No STOP or START from a member is being honoured while this continues — " +
        "check that the webhook URL in the Twilio console is exactly " +
        `${expectedUrl ?? "<APP_URL is unusable>"}.`,
      blob: { ...blob, rejectionsSinceLastAlert: rejections },
      userId: null,
    });
  }
}
