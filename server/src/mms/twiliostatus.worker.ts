import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import { SmsFailureKind } from "src/eventlog/event-messages";
import { EventLogService } from "src/eventlog/eventlog.service";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import type { Repository } from "src/utils/Repository";
import { ANSWERS_MEMBER } from "./mms-inbox.service";
import { Mms } from "./mms.entity";
import { emitThreadChanged } from "./mms.events";
import { MmsService } from "./mms.service";

@Injectable()
export class TwilioStatusWorker {
  private readonly logger = new Logger(TwilioStatusWorker.name);

  constructor(
    private readonly mmsService: MmsService,
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    private readonly eventLogService: EventLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  @WithoutOverlapping({ key: CronLease.TwilioStatus })
  async processTwilioStatusOnSchedule() {
    await this.processTwilioStatus();
  }

  /** Skips the lease; the schedule runs it through processTwilioStatusOnSchedule. */
  async processTwilioStatus() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    const queuedMessages = await this.mmsRepository.find({
      where: { status: "queued" },
    });
    for (const message of queuedMessages) {
      assertLeaseHeld();
      try {
        await this.refreshMmsData(message);
      } catch (error) {
        this.logger.error(
          `Failed to refresh MMS ${message.id}: ${thrownMessage(error)}`,
          thrownStack(error),
        );
      }
    }
  }

  async refreshMmsData(mms: Mms): Promise<Mms> {
    const message = await this.mmsService.fetchMessage(mms.twilioSid);
    if (message.errorCode) {
      this.eventLogService.sendMessage({
        type: EventType.SmsFailure,
        payload: {
          kind: SmsFailureKind.DeliveryFailed,
          phoneNumber: mms.to,
          errorCode: message.errorCode,
        },
        blob: message.toJSON(),
        userId: null,
      });
    }
    const statusChanged =
      mms.status !== message.status || mms.errorCode !== message.errorCode;
    const answeredBefore = ANSWERS_MEMBER[mms.status];
    mms.to = message.to;
    mms.from = message.from;
    mms.body = message.body;
    mms.status = message.status;
    mms.errorCode = message.errorCode;
    mms.errorMessage = message.errorMessage;
    const saved = await this.mmsRepository.save(mms);
    if (statusChanged) {
      emitThreadChanged(this.eventEmitter, {
        phoneNumber: saved.memberPhoneNumber,
        needsReplyChanged:
          saved.sentById !== null &&
          answeredBefore !== ANSWERS_MEMBER[saved.status],
      });
    }
    return saved;
  }
}
