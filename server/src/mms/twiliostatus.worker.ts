import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";

@Injectable()
export class TwilioStatusWorker {
  constructor(
    private readonly mmsService: MmsService,
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processTwilioStatus() {
    const queuedMessages = await this.mmsRepository.find({
      where: { status: "queued" },
    });
    for (const message of queuedMessages) {
      await this.mmsService.refreshMmsData(message);
    }
  }
}
