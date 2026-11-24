import { ActionTaskKind } from "@alliance/common/actionTask";
import { KoraReviewPhase } from "@alliance/common/kora";
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtRequest } from "src/auth/tokens";
import { KoraReviewStateDto } from "src/kora/dto/kora-review.dto";
import { KoraReviewService } from "src/kora/kora-review.service";
import { AuthGuard } from "../auth/guards/auth.guard";
import {
  ActionActivityService,
  ActivityAlreadyExistsException,
} from "./action-activity.service";
import { ActionsService } from "./actions.service";

@Controller("actions")
export class KoraActionReviewController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly activityService: ActionActivityService,
    private readonly reviewService: KoraReviewService,
  ) {}

  /** Starts or resumes the member's review for a Kora review action; with nothing left to review, completes the action. */
  @Get(":id/kora-review")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: KoraReviewStateDto })
  async state(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<KoraReviewStateDto> {
    const userId = req.user.sub;
    const action = await this.actionsService.findOneOrFail({ id, userId });
    if (action.taskKind !== ActionTaskKind.KoraReview) {
      throw new NotFoundException("This action has no Kora review");
    }
    await this.activityService.ensureCompletionAllowed({
      action,
      userId,
      now: new Date(),
    });
    const state = await this.reviewService.forAction({ userId, actionId: id });
    if (state.phase === KoraReviewPhase.NoneLeft) {
      await this.activityService.completeAction(id, userId).catch((error) => {
        if (!(error instanceof ActivityAlreadyExistsException)) throw error;
      });
    }
    return new KoraReviewStateDto(state);
  }
}
