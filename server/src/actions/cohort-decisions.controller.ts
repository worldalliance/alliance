import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtRequest } from "src/auth/tokens";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import {
  ArmMovePreviewDto,
  CohortDecisionDto,
  CohortDecisionNoteDto,
  CorrectCohortDecisionDto,
} from "./dto/cohort-decision.dto";

@Controller("cohort-decisions")
export class CohortDecisionsController {
  constructor(
    private readonly cohortDecisionStaffService: CohortDecisionStaffService,
  ) {}

  @Get("action/:actionId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CohortDecisionDto, isArray: true })
  async listForActionAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
  ): Promise<CohortDecisionDto[]> {
    const decisions =
      await this.cohortDecisionStaffService.findForAction(actionId);
    return decisions.map((decision) => new CohortDecisionDto(decision));
  }

  @Post("action/:actionId/user/:userId/correction")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CohortDecisionDto })
  async correctAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: CorrectCohortDecisionDto,
    @Request() req: JwtRequest,
  ): Promise<CohortDecisionDto> {
    return new CohortDecisionDto(
      await this.cohortDecisionStaffService.correct({
        actionId,
        userId,
        included: body.included,
        note: body.note,
        staffUserId: req.user.sub,
        now: new Date(),
      }),
    );
  }

  @Get("action/:actionId/user/:userId/arm-move")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ArmMovePreviewDto })
  async armMovePreviewAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<ArmMovePreviewDto> {
    return new ArmMovePreviewDto(
      await this.cohortDecisionStaffService.findArmMovePreview({
        actionId,
        userId,
      }),
    );
  }

  @Post("action/:actionId/user/:userId/move-to-arm")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async moveToArmAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: CohortDecisionNoteDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.cohortDecisionStaffService.moveToArm({
      actionId,
      userId,
      note: body.note,
      staffUserId: req.user.sub,
      now: new Date(),
    });
  }

  @Post("action/:actionId/user/:userId/remove-from-split")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async removeFromSplitAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: CohortDecisionNoteDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.cohortDecisionStaffService.removeFromSplit({
      actionId,
      userId,
      note: body.note,
      staffUserId: req.user.sub,
      now: new Date(),
    });
  }
}
