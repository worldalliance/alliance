import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Twilio from 'twilio';
import { Repository } from 'typeorm';
import { Mms } from './mms.entity';
import { SlackService } from 'src/slack/slack.service';

@Injectable()
export class MmsService {
  private readonly logger = new Logger(MmsService.name);
  private twilioClient: Twilio.Twilio;
  private twilioPhoneNumber: string;

  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    private readonly slackService: SlackService,
  ) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

    if (
      (!accountSid || !authToken || !this.twilioPhoneNumber) &&
      (process.env.NODE_ENV !== 'development' || !process.env.SEND_DEV_NOTIFS)
    ) {
      this.logger.error(
        'Twilio configuration (Account SID, Auth Token, Phone Number) is missing or invalid.',
      );
      throw new InternalServerErrorException(
        'Twilio configuration is missing or invalid.',
      );
    }

    try {
      this.twilioClient = Twilio(accountSid, authToken); // Initialize Twilio client
      this.logger.log('Twilio client initialized successfully.');
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

  async sendMms(
    to: string,
    body: string,
    mediaUrls: string[],
    cid?: string,
  ): Promise<Mms | null> {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'staging') {
      return null;
    }
    this.logger.log(
      `Attempting to send MMS to ${to} with ${mediaUrls.length} media items.`,
    );

    if (mediaUrls.length === 0) {
      this.logger.warn('No media URLs provided. Sending as SMS instead.');
    }
    if (mediaUrls.length > 10) {
      this.logger.error(
        `Cannot send more than 10 media items. Provided: ${mediaUrls.length}`,
      );
      throw new BadRequestException(
        'Exceeded maximum number of media attachments (10).',
      );
    }

    try {
      const message = await withTimeout(this.twilioClient.messages.create({
        to: to,
        from: this.twilioPhoneNumber,
        body: body,
        mediaUrl: mediaUrls,
      }), 10000, 'sendMms');

      if (!message) {
        throw new Error('Failed to send MMS');
      }

      this.logger.log(`MMS sent successfully! Message SID: ${message.sid}`);

      const mms = this.mmsRepository.create({
        to: to,
        from: this.twilioPhoneNumber,
        body: body,
        twilioSid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        cid: cid,
      });

      return this.mmsRepository.save(mms);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send MMS to ${to}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (process.env.NODE_ENV === 'production') {
        this.slackService.sendMessage(
          `Failed to send MMS to ${to}: ${errorMessage}`,
        );
      }
      return null;
    }
  }

  async refreshMmsData(mms: Mms): Promise<Mms> {
    const message = await this.twilioClient.messages.get(mms.twilioSid).fetch();
    return this.mmsRepository.save({
      ...mms,
      ...message,
    });
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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(
        `Timeout after ${ms}ms${label ? ` (${label})` : ''}`,
      );
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}