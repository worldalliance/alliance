import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
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
        await this.mmsService.refreshMmsData(message);
      } catch (error) {
        this.logger.error(
          `Failed to refresh MMS ${message.id}: ${thrownMessage(error)}`,
          thrownStack(error),
        );
      }
    }
  }
}
