import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import { SmsFailureKind } from "src/eventlog/event-messages";
import { EventLogService } from "src/eventlog/eventlog.service";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import type { Repository } from "src/utils/Repository";
import { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";

@Injectable()
export class TwilioStatusWorker {
  private readonly logger = new Logger(TwilioStatusWorker.name);

  constructor(
    private readonly mmsService: MmsService,
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    private readonly eventLogService: EventLogService,
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
    mms.to = message.to;
    mms.from = message.from;
    mms.body = message.body;
    mms.status = message.status;
    mms.errorCode = message.errorCode;
    mms.errorMessage = message.errorMessage;
    return this.mmsRepository.save(mms);
  }
}
