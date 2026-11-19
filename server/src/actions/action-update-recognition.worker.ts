import { Injectable } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron, CronExpression } from "@nestjs/schedule";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { ActionUpdateRecognitionService } from "./action-update-recognition.service";

@Injectable()
export class ActionUpdateRecognitionWorker {
  constructor(private readonly recognition: ActionUpdateRecognitionService) {}

  /** Also retries held updates, so repairing one is all it takes to send it. */
  @Cron(CronExpression.EVERY_MINUTE)
  async prepareDue() {
    await this.recognition.prepareDue(new Date());
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  @WithoutOverlapping({ key: CronLease.RecognitionDelivery })
  async deliverPrepared() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    // A large send outlasts a tick; one loop at a time keeps it from fanning out.
    let more = true;
    while (more) {
      assertLeaseHeld();
      more = await this.recognition.deliverPrepared();
    }
  }
}
