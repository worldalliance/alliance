import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectDataSource } from "@nestjs/typeorm";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgSessionLock } from "src/notifs/lock-utils";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { DataSource } from "typeorm";
import { ActionUpdateRecognitionService } from "./action-update-recognition.service";

@Injectable()
export class ActionUpdateRecognitionWorker {
  constructor(
    private readonly recognition: ActionUpdateRecognitionService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Also retries held updates, so repairing one is all it takes to send it. */
  @Cron(CronExpression.EVERY_MINUTE)
  async prepareDue() {
    await this.recognition.prepareDue(new Date());
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async deliverPrepared() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    // A large send outlasts a tick; one loop at a time keeps it from fanning out.
    await withPgSessionLock(
      this.dataSource,
      ...LOCK_KEYS.actionUpdateRecognitionDelivery,
      async () => {
        let more = true;
        while (more) {
          more = await this.recognition.deliverPrepared();
        }
      },
    );
  }
}
