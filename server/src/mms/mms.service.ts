import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { NodeEnv } from "@alliance/common/node-env";
import { R, type Result } from "@alliance/common/result";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { MessageChannel } from "src/link-tracking/message-tracking.entity";
import {
  MessageTrackingService,
  type TrackedMessage,
} from "src/link-tracking/message-tracking.service";
import { tagTextLinks } from "src/link-tracking/tag-links";
import type { Repository } from "src/utils/Repository";
import { DeliveryFailure, deliverySends } from "src/utils/notif-delivery";
import { isAnonymizedPhoneNumber } from "src/utils/phone";
import Twilio from "twilio";
import type { MessageStatus } from "twilio/lib/rest/api/v2010/account/message";
import { env } from "../config/env";
import { Mms, MmsDirection } from "./mms.entity";

/** Twilio delivers to UK numbers only from an alphanumeric sender. */
const UK_SENDER_ID = "The Alliance";

const SEND_TIMEOUT_MS = milliseconds({ seconds: 10 });

/**
 * The parts of a twilio message an {@link Mms} row is built from. Twilio types
 * the two error fields as always present, but a message that has not failed
 * carries null in both, which is what the columns hold.
 */
export type SentMessage = {
  sid: string;
  status: MessageStatus;
  errorCode: number | null;
  errorMessage: string | null;
};

export enum StaffSendFailureKind {
  Rejected = "rejected",
  Failed = "failed",
  TimedOut = "timed_out",
}

export type StaffSendFailure =
  | { kind: StaffSendFailureKind.Rejected; reason: string }
  | { kind: StaffSendFailureKind.Failed }
  | { kind: StaffSendFailureKind.TimedOut };

const canText = (to: string): boolean =>
  deliverySends() && !isAnonymizedPhoneNumber(to);

@Injectable()
export class MmsService {
  private readonly logger = new Logger(MmsService.name);
  private twilioClient: Twilio.Twilio;
  private twilioPhoneNumber: string;
  // A field, not the constant directly, so a test can shorten the deadline
  // instead of waiting it out.
  private sendTimeoutMs = SEND_TIMEOUT_MS;

  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    private readonly eventLogService: EventLogService,
    private readonly messageTracking: MessageTrackingService,
  ) {
    if (env("NODE_ENV") === NodeEnv.Test) {
      return;
    }
    const accountSid = env("TWILIO_ACCOUNT_SID")!;
    const authToken = env("TWILIO_AUTH_TOKEN")!;
    this.twilioPhoneNumber = env("TWILIO_PHONE_NUMBER")!;

    try {
      this.twilioClient = Twilio(accountSid, authToken); // Initialize Twilio client
      this.logger.log("Twilio client initialized successfully.");
    } catch (error) {
      const errorMessage = thrownMessage(error);
      this.logger.error(
        `Failed to initialize Twilio client: ${errorMessage}`,
        thrownStack(error),
      );
      throw new InternalServerErrorException(
        `Failed to initialize Twilio client: ${errorMessage}`,
      );
    }
  }

  async sendMms(params: {
    to: string;
    userId: number;
    body: string;
    mediaUrls: string[];
    tracking: TrackedMessage | null;
  }): Promise<Mms | null> {
    const { to, userId, mediaUrls, tracking } = params;
    let cid: string | null = null;
    if (tracking) {
      const tracked = await R.fromPromise(
        this.messageTracking.track({
          message: tracking,
          channel: MessageChannel.Sms,
        }),
      );
      if (!tracked.ok)
        return this.reportFailure({ to, userId, error: tracked.error });
      cid = tracked.value;
    }
    const body = cid
      ? tagTextLinks({ text: params.body, trackingId: cid })
      : params.body;
    if (!canText(to)) {
      return this.saveUndelivered({ to, body, cid, sentById: null });
    }
    this.logger.log(
      `Attempting to send MMS to user ${userId} with ${mediaUrls.length} media items.`,
    );

    if (mediaUrls.length === 0) {
      this.logger.warn("No media URLs provided. Sending as SMS instead.");
    }
    if (mediaUrls.length > 10) {
      this.logger.error(
        `Cannot send more than 10 media items. Provided: ${mediaUrls.length}`,
      );
      throw new BadRequestException(
        "Exceeded maximum number of media attachments (10).",
      );
    }

    try {
      const sending = this.dispatch({ to, body, mediaUrls });
      const message = await withTimeout(sending, this.sendTimeoutMs).catch(
        async (error: unknown) => {
          if (cid) await this.messageTracking.discard(cid);
          throw error;
        },
      );

      if (message === TIMED_OUT) {
        this.recordLateSend({
          sending,
          to,
          userId,
          body,
          cid,
          sentById: null,
        });
        throw new Error(`sendMms timed out after ${this.sendTimeoutMs}ms`);
      }

      this.logger.log(`MMS sent successfully! Message SID: ${message.sid}`);

      return this.saveSent({ message, to, body, cid, sentById: null });
    } catch (error) {
      return this.reportFailure({ to, userId, error });
    }
  }

  /**
   * A rejection carries Twilio's reason, for the staff member to read; any
   * other failure, such as a Twilio outage or bad credentials, carries none.
   * Every failure, a timeout included, raises the SMS-failure alert a failed
   * broadcast raises, since Twilio also rejects sends for problems with our
   * account and a hung API is an outage. The text is dated from when its send
   * began, so a member's text that arrives while Twilio answers sorts after it.
   */
  async sendStaffText(params: {
    to: string;
    userId: number;
    body: string;
    sentById: number;
  }): Promise<Result<Mms, StaffSendFailure>> {
    const { to, userId, body, sentById } = params;
    if (!canText(to)) {
      return R.success(
        await this.saveUndelivered({ to, body, cid: null, sentById }),
      );
    }
    const createdAt = new Date();
    const sending = this.dispatch({ to, body, mediaUrls: [] });
    const sent = await R.fromPromise(withTimeout(sending, this.sendTimeoutMs));
    if (!sent.ok) {
      this.logError({
        to,
        text: `Staff text to user ${userId} not sent: ${thrownMessage(sent.error)}`,
        error: sent.error,
      });
      this.alertFailure({ to, errorMessage: thrownMessage(sent.error) });
      const reason =
        sent.error instanceof Twilio.RestException &&
        sent.error.status === 400 &&
        sent.error.code !== undefined
          ? sent.error.message
          : undefined;
      if (!reason) {
        return R.failure({ kind: StaffSendFailureKind.Failed });
      }
      return R.failure({
        kind: StaffSendFailureKind.Rejected,
        reason: reason.replaceAll(to, "this number"),
      });
    }
    if (sent.value === TIMED_OUT) {
      this.logger.warn(
        `Staff text to user ${userId} timed out after ${this.sendTimeoutMs}ms`,
      );
      this.alertFailure({
        to,
        errorMessage: `timed out after ${this.sendTimeoutMs}ms`,
      });
      this.recordLateSend({
        sending,
        to,
        userId,
        body,
        cid: null,
        sentById,
        createdAt,
      });
      return R.failure({ kind: StaffSendFailureKind.TimedOut });
    }
    const saved = await R.fromPromise(
      this.saveSent({
        message: sent.value,
        to,
        body,
        cid: null,
        sentById,
        createdAt,
      }),
    );
    if (!saved.ok) {
      this.logError({
        to,
        text: `Staff text to user ${userId} was sent (SID ${sent.value.sid}) but not recorded: ${thrownMessage(saved.error)}`,
        error: saved.error,
      });
      throw saved.error;
    }
    return R.success(saved.value);
  }

  /** Sends a text with no Mms row or link tracking, so we keep no copy of the body. */
  async sendUnrecordedText(params: {
    to: string;
    body: string;
  }): Promise<Result<{ sid: string }, DeliveryFailure>> {
    const { to, body } = params;
    if (!canText(to)) {
      return R.failure(DeliveryFailure.Unavailable);
    }
    const sent = await R.fromPromise(
      withTimeout(
        this.dispatch({ to, body, mediaUrls: [] }),
        this.sendTimeoutMs,
      ),
    );
    if (!sent.ok) {
      this.logError({
        to,
        text: `Unrecorded text not sent: ${thrownMessage(sent.error)}`,
        error: sent.error,
      });
      return R.failure(DeliveryFailure.Failed);
    }
    if (sent.value === TIMED_OUT) {
      this.logger.warn(
        `Unrecorded text timed out after ${this.sendTimeoutMs}ms`,
      );
      return R.failure(DeliveryFailure.Failed);
    }
    return R.success({ sid: sent.value.sid });
  }

  private dispatch(params: {
    to: string;
    body: string;
    mediaUrls: string[];
  }): Promise<SentMessage> {
    const { to, body, mediaUrls } = params;
    return this.twilioClient.messages.create({
      to,
      from: this.senderFor(to),
      body,
      mediaUrl: mediaUrls,
    });
  }

  private reportFailure(params: {
    to: string;
    userId: number;
    error: unknown;
  }): null {
    const { to, userId, error } = params;
    const errorMessage = thrownMessage(error);
    this.logError({
      to,
      text: `Failed to send MMS to user ${userId}: ${errorMessage}`,
      error,
    });
    this.alertFailure({ to, errorMessage });
    return null;
  }

  private alertFailure(params: { to: string; errorMessage: string }) {
    const { to, errorMessage } = params;
    if (env("NODE_ENV") !== NodeEnv.Production) return;
    this.eventLogService.sendMessage({
      type: EventType.SmsFailure,
      message: `Failed to send MMS to ${to}: ${errorMessage}`,
      blob: { errorMessage, to, from: this.senderFor(to) },
      userId: null,
    });
  }

  /** Twilio's error text quotes the number it rejected. */
  private logError(params: { to: string; text: string; error: unknown }) {
    const { to, text, error } = params;
    const redact = (logged: string) => logged.replaceAll(to, "[redacted]");
    this.logger.error(redact(text), redact(thrownStack(error)));
  }

  private senderFor(to: string): string {
    return to.startsWith("+44") ? UK_SENDER_ID : this.twilioPhoneNumber;
  }

  private saveSent(params: {
    message: SentMessage;
    to: string;
    body: string;
    cid: string | null;
    sentById: number | null;
    createdAt?: Date;
  }): Promise<Mms> {
    const { message, to, body, cid, sentById, createdAt } = params;
    return this.mmsRepository.save(
      this.mmsRepository.create({
        to,
        from: this.senderFor(to),
        body,
        direction: MmsDirection.Outbound,
        sentById,
        twilioSid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        cid,
        createdAt,
      }),
    );
  }

  /** Stands in for a send where delivery is off or the number is anonymized. */
  private saveUndelivered(params: {
    to: string;
    body: string;
    cid: string | null;
    sentById: number | null;
  }): Promise<Mms> {
    const { to, body, cid, sentById } = params;
    return this.mmsRepository.save(
      this.mmsRepository.create({
        to,
        from: "+15555550100",
        body,
        direction: MmsDirection.Outbound,
        sentById,
        status: "sent",
        twilioSid: "test-sid",
        errorCode: null,
        errorMessage: null,
        cid,
      }),
    );
  }

  /**
   * Nothing cancels a send that missed the deadline, so twilio may still accept
   * it. Records it when it lands: a message that went out with no row of its
   * own has no cid for {@link setClickedLinkByCid} to match a click against and
   * no id for a caller to hang an opt-in on. The caller has already reported
   * the timeout by now, so this can only write down what happened.
   */
  private recordLateSend(params: {
    sending: Promise<SentMessage>;
    to: string;
    userId: number;
    body: string;
    cid: string | null;
    sentById: number | null;
    createdAt?: Date;
  }): void {
    const { sending, to, userId, body, cid, sentById, createdAt } = params;
    void sending
      .then(
        async (message) => {
          const mms = await this.saveSent({
            message,
            to,
            body,
            cid,
            sentById,
            createdAt,
          });
          this.logger.warn(
            `MMS to user ${userId} landed after ${this.sendTimeoutMs}ms and was recorded as ${mms.id} (SID ${message.sid})`,
          );
        },
        async (error: unknown) => {
          if (cid) await this.messageTracking.discard(cid);
          throw error;
        },
      )
      .catch((error: unknown) => {
        this.logError({
          to,
          text: `MMS to user ${userId} failed after ${this.sendTimeoutMs}ms: ${thrownMessage(error)}`,
          error,
        });
      });
  }

  async refreshMmsData(mms: Mms): Promise<Mms> {
    const message = await this.twilioClient.messages.get(mms.twilioSid).fetch();
    if (message.errorCode) {
      this.eventLogService.sendMessage({
        type: EventType.SmsFailure,
        message: `MMS to ${mms.to} failed with status ${message.status}. Error code: ${message.errorCode}`,
        blob: message.toJSON(),
        userId: null,
      });
    }
    mms.to = message.to;
    mms.from = message.from;
    mms.body = message.body;
    mms.status = message.status;
    mms.errorCode = message.errorCode;
    mms.errorMessage = message.errorMessage;
    return this.mmsRepository.save(mms);
  }

  // doesnt throw to allow fallback to mail - TODO this is kind of unintuitive
  async setClickedLinkByCid(cid: string): Promise<boolean> {
    const mms = await this.mmsRepository.findOne({ where: { cid } });
    if (!mms) {
      return false;
    }
    mms.clickedLink = true;
    await this.mmsRepository.save(mms);
    return true;
  }
}
