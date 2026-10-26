import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthOptionalGuard } from "src/auth/guards/authoptional.guard";
import type { JwtRequest } from "src/auth/tokens";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import {
  CommunityUserInfoDto,
  UserActionRelationsResponseDto,
} from "src/user/dto/user-action-relations.dto";
import { ProfileDto } from "src/user/dto/user.dto";
import { UserVisibilityContextService } from "src/user/user-visibility-context.service";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import {
  AcknowledgeDeadlineShortening,
  ApiAcknowledgeDeadlineShortening,
} from "./acknowledge-deadline-shortening";
import { ActionSuspensionService } from "./action-suspension.service";
import { ActionsService } from "./actions.service";
import {
  ActionActivityDto,
  ActionWithdrawalDto,
  CreateActionActivityDto,
  WelcomeQueueDto,
} from "./dto/action-activity.dto";
import { ActionEventDto, CreateActionEventDto } from "./dto/action-event.dto";
import {
  ActionDto,
  ActionReferralCodeDto,
  ActionSharePreviewDto,
  CreateActionDto,
  EvaluateCohortExpressionDto,
  EvaluateCohortExpressionResponseDto,
  ExportActionDto,
  PasteJsonDto,
  SetPriorityDto,
  UpdateActionDto,
} from "./dto/action.dto";
import { AdminActionDto, AdminActionListItemDto } from "./dto/admin-action.dto";
import { CommunityCompletedActionsCountDto } from "./dto/community-completed-actions-count.dto";
import { ScheduledPlansOverviewDto } from "./dto/scheduled-plans.dto";
import { ShareUrlDto, ShareUrlStatsDto } from "./dto/share-url.dto";
import { UserCompletedActionsCountDto } from "./dto/user-completed-actions-count.dto";
import { ForumActionCompleterWorker } from "./forum-action-completer.worker";

@Controller("actions")
export class ActionsController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly suspensionService: ActionSuspensionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly forumActionCompleterWorker: ForumActionCompleterWorker,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly userVisibilityContextService: UserVisibilityContextService,
  ) {}

  @Get("loggedIn")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllLoggedIn(
    @Request() req: JwtRequest,
    @Query("sorted", new ParseBoolPipe({ optional: true })) sorted?: boolean,
  ): Promise<ActionDto[]> {
    return this.actionsService.findMemberPublic(req.user.sub, sorted);
  }

  @Get("withdrawals/byForm/:formId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionWithdrawalDto, isArray: true })
  async getWithdrawalsAdmin(
    @Param("formId", ParseIntPipe) formId: number,
  ): Promise<ActionWithdrawalDto[]> {
    const activities = await this.actionsService.getWithdrawalsForForm(formId);
    return activities.map((a) => new ActionWithdrawalDto(a));
  }

  @Post("priorities")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async setPriorityAdmin(@Body() dto: SetPriorityDto): Promise<void> {
    return this.actionsService.setPriorityOrder(dto);
  }

  @Get("all")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [AdminActionListItemDto] })
  async findAllWithDraftsAdmin(): Promise<AdminActionListItemDto[]> {
    const actions = await this.actionsService.findAllSorted({
      events: true,
      suite: true,
      reviewers: true,
      formVariants: true,
      followUpForms: true,
    });
    return actions.map((action) => new AdminActionListItemDto(action));
  }

  @Get("communityCompletedActionsCount")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary:
      "Count of (member, action) pairs among a community's current members whose latest completion or withdrawal is a completion",
  })
  @ApiOkResponse({ type: CommunityCompletedActionsCountDto })
  @ApiQuery({ name: "communityId", type: Number })
  async communityCompletedActionsCount(
    @Request() req: JwtRequest,
    @Query("communityId", ParseIntPipe) communityId: number,
  ): Promise<CommunityCompletedActionsCountDto> {
    return new CommunityCompletedActionsCountDto(
      await this.actionsService.countCommunityCompletedActions(
        req.user.sub,
        communityId,
      ),
    );
  }

  @Get("slug/:id")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionDto> {
    return this.actionsService.findOneDto(id, req.user?.sub);
  }

  @Get(":id/sharePreview")
  @Public()
  @ApiQuery({ name: "sid", required: false, type: String })
  @ApiQuery({
    name: "ref",
    required: false,
    type: String,
    deprecated: true,
    description: "Deprecated alias for `sid`; retained for older clients.",
  })
  @ApiOkResponse({ type: ActionSharePreviewDto })
  async getSharePreview(
    @Param("id", ParseIntPipe) id: number,
    @Query("sid") sid?: string,
    @Query("ref") ref?: string,
  ): Promise<ActionSharePreviewDto> {
    return new ActionSharePreviewDto(
      await this.actionsService.getSharePreview(id, sid ?? ref),
    );
  }

  @Post(":id/referralCode")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionReferralCodeDto })
  async getActionReferralCode(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionReferralCodeDto> {
    return new ActionReferralCodeDto(
      await this.actionsService.getOrCreateActionReferralCode(id, req.user.sub),
    );
  }

  @Get("adminslug/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionDto })
  @ApiUnauthorizedResponse()
  async findOneAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.actionsService.findOneOrFail({
        id,
        userId: req.user.sub,
        includeUnpublishedUpdates: true,
      }),
    );
  }

  @Get(":id/incomplete-users")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async getIncompleteUsersAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ProfileDto[]> {
    const users = await this.actionsService.findIncompleteUsersForAction(id);
    return users.map((user) => new ProfileDto(user));
  }

  @Get("welcome-queue")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: WelcomeQueueDto })
  async getWelcomeQueueAdmin(): Promise<WelcomeQueueDto> {
    return new WelcomeQueueDto(await this.actionsService.findWelcomeQueue());
  }

  @Post("evaluate-cohort")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: EvaluateCohortExpressionResponseDto })
  async evaluateCohortAdmin(
    @Body() dto: EvaluateCohortExpressionDto,
  ): Promise<EvaluateCohortExpressionResponseDto> {
    const userIds = await this.actionsService.evaluateCohortExpressionBatch(
      dto.expression,
    );
    return new EvaluateCohortExpressionResponseDto(userIds);
  }

  @Post("create")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionDto })
  async createAdmin(
    @Body() createActionDto: CreateActionDto,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.actionsService.create(createActionDto),
    );
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateActionDto: UpdateActionDto,
    @Request() req: JwtRequest,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.actionsService.update(id, updateActionDto, req.user.sub),
    );
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  removeAdmin(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.actionsService.remove(id);
  }

  @Get("userCompletedCount/:id")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: UserCompletedActionsCountDto })
  @ApiOperation({
    summary:
      "Count of actions the user has completed, by their latest completion or withdrawal on each (independent of feed pagination)",
  })
  async userCompletedCount(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserCompletedActionsCountDto> {
    return new UserCompletedActionsCountDto(
      await this.userVisibilityContextService.getCompletedActionCount(id),
    );
  }

  @Post(":id/events")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionEventDto })
  @ApiAcknowledgeDeadlineShortening()
  async addEventAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() actionEventDto: CreateActionEventDto,
    @Request() req: JwtRequest,
    @AcknowledgeDeadlineShortening()
    acknowledgeDeadlineShortening: boolean,
  ): Promise<ActionEventDto> {
    return new ActionEventDto(
      await this.actionsService.addEvent({
        actionId: id,
        event: actionEventDto,
        userId: req.user?.sub,
        acknowledgeDeadlineShortening,
      }),
    );
  }

  @Post("dismiss/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async dismissAction(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    return new ActionActivityDto(
      await this.actionsService.dismissAction(req.user.sub, id),
    );
  }

  @Post("createActivity")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async createActivityAdmin(
    @Body() activityDto: CreateActionActivityDto,
  ): Promise<ActionActivityDto> {
    return new ActionActivityDto(
      await this.actionsService.adminCreateActivity(activityDto),
    );
  }

  @Post("archive/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionDto })
  async archiveAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(await this.actionsService.archive(id));
  }

  @Post("unarchive/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionDto })
  async unarchiveAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(await this.actionsService.unarchive(id));
  }

  @Get("export/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ExportActionDto })
  async exportActionAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Query("events", new ParseBoolPipe({ optional: true })) events?: boolean,
    @Query("taskForm", new ParseBoolPipe({ optional: true }))
    taskForm?: boolean,
    @Query("reminders", new ParseBoolPipe({ optional: true }))
    reminders?: boolean,
    @Query("suite", new ParseBoolPipe({ optional: true })) suite?: boolean,
  ): Promise<ExportActionDto> {
    return this.actionsService.exportAction(
      id,
      events,
      reminders,
      taskForm,
      suite,
    );
  }

  @Post("pasteJson")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminActionDto })
  async pasteJsonAdmin(@Body() body: PasteJsonDto): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.actionsService.importAction(body.body),
    );
  }

  @Get("scheduledPlans")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ScheduledPlansOverviewDto })
  async scheduledPlansAdmin(
    @Query("rangeStart") rangeStart: Date,
    @Query("rangeEnd") rangeEnd: Date,
  ): Promise<ScheduledPlansOverviewDto> {
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    const [suspensionPlans, forumAutocompletePlans] = await Promise.all([
      this.suspensionService.getSuspendPlans(start, end, 6),
      this.forumActionCompleterWorker.getAutocompletePlans(start, end),
    ]);

    return new ScheduledPlansOverviewDto({
      suspensionPlans,
      forumAutocompletePlans,
    });
  }

  @Get("shareLinksForForm/:formId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlDto, isArray: true })
  async shareLinksForFormAdmin(
    @Param("formId", ParseIntPipe) formId: number,
  ): Promise<ShareUrlDto[]> {
    const shareUrls = await this.actionsService.getShareLinksForForm(formId);
    return shareUrls.map((shareUrl) => new ShareUrlDto(shareUrl));
  }

  @Get("shareUrlStats/:actionId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlStatsDto, isArray: true })
  @ApiQuery({ name: "questionId", required: false, type: String })
  async shareUrlStatsAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Query("questionId") questionId?: string,
  ): Promise<ShareUrlStatsDto[]> {
    const stats = await this.actionsService.getShareUrlStats(
      actionId,
      questionId,
    );
    return stats.map((stat) => new ShareUrlStatsDto(stat));
  }

  // TODO move ====================================
  @Get("action-relations")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserActionRelationsResponseDto })
  async actionRelationsAdmin(): Promise<UserActionRelationsResponseDto> {
    return new UserActionRelationsResponseDto(
      await this.actionsService.findUserActionRelations(),
    );
  }

  @Get("action-relations/:userId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserActionRelationsResponseDto })
  async actionRelationsForUserAdmin(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<UserActionRelationsResponseDto> {
    return new UserActionRelationsResponseDto(
      await this.actionsService.findUserActionRelationsForUser(userId),
    );
  }

  @Get("communityMemberInfo/:communityId/admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityUserInfoDto })
  async getCommunityMemberInfoAdmin(
    @Param("communityId", ParseIntPipe) communityId: number,
  ): Promise<CommunityUserInfoDto> {
    return new CommunityUserInfoDto(
      await this.actionsService.findMemberInfoByCommunityId(communityId),
    );
  }

  @Get("communityMemberInfo/:communityId")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityUserInfoDto })
  async getCommunityMemberInfo(
    @Request() req: JwtRequest,
    @Param("communityId", ParseIntPipe) communityId: number,
  ): Promise<CommunityUserInfoDto> {
    return new CommunityUserInfoDto(
      await this.actionsService.findMemberInfo(req.user.sub, communityId),
    );
  }
}
