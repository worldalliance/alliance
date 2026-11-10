import { ActionTaskKind } from "@alliance/common/actionTask";
import { HttpException, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import {
  KORA_MEMBER_REVIEWED,
  type KoraMemberReviewed,
} from "src/kora/kora-events";
import type { Repository } from "src/utils/Repository";
import { ActionActivityService } from "./action-activity.service";
import { Action } from "./entities/action.entity";

/** Completes a member's Kora review actions once they finish their first Kora assignment. */
@Injectable()
export class KoraActionListener {
  private readonly logger = new Logger(KoraActionListener.name);

  constructor(
    @InjectRepository(Action)
    private readonly actions: Repository<Action>,
    private readonly activityService: ActionActivityService,
  ) {}

  @OnEvent(KORA_MEMBER_REVIEWED, { async: true, promisify: true })
  async onMemberReviewed({ userId }: KoraMemberReviewed): Promise<void> {
    const actions = await this.actions.find({
      where: { taskKind: ActionTaskKind.KoraReview, archived: false },
      select: { id: true },
    });
    for (const { id } of actions) {
      try {
        await this.activityService.completeAction(id, userId);
      } catch (error) {
        // Already completed, or not open to this member: nothing to do.
        if (!(error instanceof HttpException)) {
          this.logger.error(
            `Couldn't complete Kora action ${id} for user ${userId}`,
            error,
          );
        }
      }
    }
  }
}
