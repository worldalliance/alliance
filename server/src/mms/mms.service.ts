import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import type { Repository } from "src/utils/Repository";
import { isAnonymizedPhoneNumber } from "src/utils/phone";
import Twilio from "twilio";
import type { MessageStatus } from "twilio/lib/rest/api/v2010/account/message";
import { Mms } from "./mms.entity";

const SEND_TIMEOUT_MS = 10_000;

/**
 * The parts of a twilio message an {@link Mms} row is built from. Twilio types
 * the two error fields as always present, but a message that has not failed
 * carries null in both, which is what the columns hold.
 */
type SentMessage = {
  sid: string;
  status: MessageStatus;
  errorCode: number | null;
  errorMessage: string | null;
};

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
  ) {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

    if (
      (!accountSid || !authToken || !this.twilioPhoneNumber) &&
      (process.env.NODE_ENV !== "development" || !process.env.SEND_DEV_NOTIFS)
    ) {
      this.logger.error(
        "Twilio configuration (Account SID, Auth Token, Phone Number) is missing or invalid.",
      );
      throw new InternalServerErrorException(
        "Twilio configuration is missing or invalid.",
      );
    }

    try {
      this.twilioClient = Twilio(accountSid, authToken); // Initialize Twilio client
      this.logger.log("Twilio client initialized successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to initialize Twilio client: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        `Failed to initialize Twilio client: ${errorMessage}`,
      );
    }
  }

  async sendMms(params: {
    to: string;
    body: string;
    mediaUrls: string[];
    cid: string | null;
  }): Promise<Mms | null> {
    const { to, body, mediaUrls, cid } = params;
    if (
      process.env.NODE_ENV === "test" ||
      !(
        process.env.NODE_ENV === "production" ||
        process.env.SEND_DEV_NOTIFS === "1"
      ) ||
      isAnonymizedPhoneNumber(to)
    ) {
      const mms = this.mmsRepository.create({
        to: to,
        from: "+15555550100",
        body: body,
        status: "sent",
        twilioSid: "test-sid",
        errorCode: null,
        errorMessage: null,
        cid,
      });
      return this.mmsRepository.save(mms);
    }
    this.logger.log(
      `Attempting to send MMS to ${to} with ${mediaUrls.length} media items.`,
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
      const sending = this.twilioClient.messages.create({
        to: to,
        from: this.twilioPhoneNumber,
        body: body,
        mediaUrl: mediaUrls,
      });
      const message = await withTimeout(sending, this.sendTimeoutMs);

      if (message === TIMED_OUT) {
        this.recordLateSend({ sending, to, body, cid });
        throw new Error(`sendMms timed out after ${this.sendTimeoutMs}ms`);
      }

      this.logger.log(`MMS sent successfully! Message SID: ${message.sid}`);

      return this.saveSent({ message, to, body, cid });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send MMS to ${to}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (process.env.NODE_ENV === "production") {
        this.eventLogService.sendMessage({
          type: EventType.SmsFailure,
          message: `Failed to send MMS to ${to}: ${errorMessage}`,
          blob: { errorMessage, to, from: this.twilioPhoneNumber },
          userId: null,
        });
      }
      return null;
    }
  }

  private saveSent(params: {
    message: SentMessage;
    to: string;
    body: string;
    cid: string | null;
  }): Promise<Mms> {
    const { message, to, body, cid } = params;
    return this.mmsRepository.save(
      this.mmsRepository.create({
        to: to,
        from: this.twilioPhoneNumber,
        body: body,
        twilioSid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        cid,
      }),
    );
  }

  /**
   * Nothing cancels a send that missed the deadline, so twilio may still accept
   * it. Records it when it lands: a message that went out with no row of its
   * own has no cid for {@link setClickedLinkByCid} to match a click against and
   * no id for a caller to hang an opt-in on. sendMms has already returned null
   * by now, so this can only write down what happened.
   */
  private recordLateSend(params: {
    sending: Promise<SentMessage>;
    to: string;
    body: string;
    cid: string | null;
  }): void {
    const { sending, to, body, cid } = params;
    void sending
      .then(async (message) => {
        const mms = await this.saveSent({ message, to, body, cid });
        this.logger.warn(
          `MMS to ${to} landed after ${this.sendTimeoutMs}ms and was recorded as ${mms.id} (SID ${message.sid})`,
        );
      })
      .catch((error: unknown) => {
        this.logger.error(
          `MMS to ${to} failed after ${this.sendTimeoutMs}ms: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
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
