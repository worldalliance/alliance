import { HttpException, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  KORA_ACTION_REVIEWED,
  type KoraActionReviewed,
} from "src/kora/kora-events";
import { ActionActivityService } from "./action-activity.service";

/** Completes a member's Kora review action once they finish the assignment they started from it. */
@Injectable()
export class KoraActionListener {
  private readonly logger = new Logger(KoraActionListener.name);

  constructor(private readonly activityService: ActionActivityService) {}

  @OnEvent(KORA_ACTION_REVIEWED, { async: true, promisify: true })
  async onActionReviewed({
    userId,
    actionId,
  }: KoraActionReviewed): Promise<void> {
    try {
      await this.activityService.completeAction(actionId, userId);
    } catch (error) {
      // Already completed, or no longer open to this member: nothing to do.
      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Couldn't complete Kora action ${actionId} for user ${userId}`,
          error,
        );
      }
    }
  }
}
