/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
  type FeedActionActivity,
} from "@alliance/common/actionActivity";
import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
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
import { PosthogService } from "src/posthog/posthog.service";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import {
  CommunityUserInfoDto,
  UserActionRelationsResponseDto,
} from "src/user/dto/user-action-relations.dto";
import { ProfileDto } from "src/user/dto/user.dto";
import { UserService } from "src/user/user.service";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import {
  AcknowledgeDeadlineShortening,
  ApiAcknowledgeDeadlineShortening,
} from "./acknowledge-deadline-shortening";
import { ActionFormVariantService } from "./action-form-variant.service";
import { ActionsService } from "./actions.service";
import {
  ActionFormVariantDto,
  ActionFormVariantsListDto,
  CreateActionFormVariantDto,
  UpdateActionFormVariantDto,
} from "./dto/action-form-variant.dto";
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  ActionReferralCodeDto,
  ActionSharePreviewDto,
  ActionSuiteDto,
  ActionWithdrawalDto,
  AdminActionDto,
  AdminActionListItemDto,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionSuiteDto,
  EvaluateCohortExpressionDto,
  EvaluateCohortExpressionResponseDto,
  ExportActionDto,
  GlobalFeedItemDto,
  HomeFeedItemDto,
  PasteJsonDto,
  ScheduledPlansOverviewDto,
  SetPriorityDto,
  TimelineFeedItemDto,
  UpdateActionDto,
  UpdateActionEventDto,
  WelcomeQueueDto,
} from "./dto/action.dto";
import { CommunityCompletedActionsCountDto } from "./dto/community-completed-actions-count.dto";
import {
  AdminFollowUpFormDto,
  CreateFollowUpFormDto,
  UpdateFollowUpFormDto,
} from "./dto/follow-up-form.dto";
import { ShareUrlDto, ShareUrlStatsDto } from "./dto/share-url.dto";
import { UserCompletedActionsCountDto } from "./dto/user-completed-actions-count.dto";
import { loadedActionFollowUpForms } from "./entities/action.entity";
import { parseFeedPage } from "./feed-page";
import { ForumActionCompleterWorker } from "./forum-action-completer.worker";

const GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT = 30;
const GLOBAL_FEED_MEMBERS_MAX_LIMIT = 50;

function capGlobalFeedMembersLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), GLOBAL_FEED_MEMBERS_MAX_LIMIT);
}

function parseFeedActivityType(value: string): FeedActionActivity {
  const type = ACTION_ACTIVITY_FEED_VISIBLE_TYPES.find((t) => t === value);
  if (type) {
    return type;
  }
  throw new BadRequestException(`Invalid activityType: ${value}`);
}

@Controller("actions")
export class ActionsController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly forumActionCompleterWorker: ForumActionCompleterWorker,
    private readonly actionFormVariantService: ActionFormVariantService,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly posthog: PosthogService,
    private readonly userService: UserService,
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

  @Get("activities/feed")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  @ApiOperation({
    summary: "Get recent activities from all actions for the feed",
  })
  async getActivityFeed(
    @Request() req: JwtRequest,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<ActionActivityDto[]> {
    const page = parseFeedPage({ limit, before });

    return await this.actionsService.getActivityFeed(
      page.limit,
      page.before,
      comments,
      req.user?.sub,
    );
  }

  @Get("globalFeed")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [GlobalFeedItemDto] })
  @ApiOperation({
    summary:
      "Get unified global feed with activities, updates, and new members",
  })
  async getGlobalFeed(
    @Request() req: JwtRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<GlobalFeedItemDto[]> {
    return this.actionsService.getGlobalFeed(limit ?? 15, req.user?.sub);
  }

  @Get("globalFeed/activityGroupMembers")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  @ApiOperation({
    summary: "Paginated members behind a global-feed activity-group item",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "afterId", required: false, type: Number })
  async getGlobalFeedActivityMembers(
    @Request() req: JwtRequest,
    @Query("actionId", ParseIntPipe) actionId: number,
    @Query("activityType") activityType: string,
    @Query(
      "limit",
      new DefaultValuePipe(GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
    @Query("afterId", new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return this.actionsService.getActivityGroupMembers(
      actionId,
      parseFeedActivityType(activityType),
      capGlobalFeedMembersLimit(limit),
      afterId,
      req.user.sub,
    );
  }

  @Get("globalFeed/newMembers")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  @ApiOperation({
    summary: "Paginated members behind the global-feed new-members item",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "afterId", required: false, type: Number })
  async getGlobalFeedNewMembers(
    @Query(
      "limit",
      new DefaultValuePipe(GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
    @Query("afterId", new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return this.actionsService.getNewMembers(
      capGlobalFeedMembersLimit(limit),
      afterId,
    );
  }

  @Get("globalFeed/forumCommentMembers")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  @ApiOperation({
    summary: "Paginated members behind a global-feed forum-comments item",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "afterId", required: false, type: Number })
  async getGlobalFeedCommentMembers(
    @Request() req: JwtRequest,
    @Query("postId", ParseIntPipe) postId: number,
    @Query(
      "limit",
      new DefaultValuePipe(GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
    @Query("afterId", new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return this.actionsService.getForumCommentMembers(
      postId,
      capGlobalFeedMembersLimit(limit),
      afterId,
      req.user.sub,
    );
  }

  @Get("activities/:id")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async getActivity(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionActivityDto> {
    return this.actionsService.getActivity(id, req.user?.sub);
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

  @Get(":id/activities")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  @ApiOperation({ summary: "Get recent activities for an action" })
  async getActionActivities(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
    @Query("before") before?: string,
  ): Promise<ActionActivityDto[]> {
    const beforeDate = before ? new Date(before) : undefined;
    return this.actionsService.getActionActivities(
      id,
      limit,
      comments,
      req.user?.sub,
      beforeDate,
    );
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

  @Get("friendActivity/:actionId")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async friendActivityForAction(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Request() req: JwtRequest,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
    @Query("limit", new ParseIntPipe({ optional: true }))
    limit?: string,
  ): Promise<ActionActivityDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    return this.actionsService.friendActivityForAction(
      req.user.sub,
      actionId,
      comments,
      limitNum,
    );
  }

  @Get("friendActivity")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async friendActivity(
    @Request() req: JwtRequest,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
    @Query("limit", new ParseIntPipe({ optional: true }))
    limit?: string,
    @Query("before") before?: string,
  ): Promise<ActionActivityDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    const beforeDate = before ? new Date(before) : undefined;
    return this.actionsService.friendActivity(
      req.user.sub,
      comments,
      limitNum,
      beforeDate,
    );
  }

  @Get("homeFeed")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [HomeFeedItemDto] })
  @ApiOperation({
    summary:
      "Get contentful completions from friends and group members, interleaved with cluster-mate forum comments on cluster-tagged posts",
  })
  async homeFeed(
    @Request() req: JwtRequest,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const page = parseFeedPage({ limit, before });

    return this.actionsService.homeFeed(
      req.user.sub,
      page.limit,
      page.before,
      comments,
    );
  }

  @Get("communityActivity")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async communityActivity(
    @Request() req: JwtRequest,
    @Query("communityId", ParseIntPipe) communityId: number,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<ActionActivityDto[]> {
    const page = parseFeedPage({ limit, before });

    return this.actionsService.communityActivity(
      page.limit,
      page.before,
      communityId,
      comments,
      req.user.sub,
    );
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

  @Post(":id/follow-up-forms")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminFollowUpFormDto })
  async createFollowUpFormAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateFollowUpFormDto,
  ): Promise<AdminFollowUpFormDto> {
    const created = await this.actionsService.createFollowUpForm(id, dto);
    const withForm = await this.actionsService.findOneOrFail({
      id,
      serverSide: true,
    });
    const found = loadedActionFollowUpForms(withForm).find(
      (f) => f.id === created.id,
    );
    return new AdminFollowUpFormDto(found ?? created);
  }

  @Patch("follow-up-forms/:followUpFormId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminFollowUpFormDto })
  async updateFollowUpFormAdmin(
    @Param("followUpFormId", ParseIntPipe) followUpFormId: number,
    @Body() dto: UpdateFollowUpFormDto,
  ): Promise<AdminFollowUpFormDto> {
    const updated = await this.actionsService.updateFollowUpForm(
      followUpFormId,
      dto,
    );
    return new AdminFollowUpFormDto(updated);
  }

  @Delete("follow-up-forms/:followUpFormId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFollowUpFormAdmin(
    @Param("followUpFormId", ParseIntPipe) followUpFormId: number,
  ): Promise<void> {
    return this.actionsService.deleteFollowUpForm(followUpFormId);
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

  @Get(":id/form-variants")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantsListDto })
  async listFormVariantsAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionFormVariantsListDto> {
    const [variants, stats] = await Promise.all([
      this.actionFormVariantService.listForAction(id),
      this.actionFormVariantService.getStatsForAction(id),
    ]);
    return new ActionFormVariantsListDto(variants, stats);
  }

  @Post(":id/form-variants")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantDto })
  async createFormVariantAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateActionFormVariantDto,
  ): Promise<ActionFormVariantDto> {
    const variant = await this.actionFormVariantService.createVariant(id, body);
    return new ActionFormVariantDto(variant);
  }

  @Patch("form-variants/:variantId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantDto })
  async updateFormVariantAdmin(
    @Param("variantId", ParseIntPipe) variantId: number,
    @Body() body: UpdateActionFormVariantDto,
  ): Promise<ActionFormVariantDto> {
    const variant = await this.actionFormVariantService.updateVariant(
      variantId,
      body,
    );
    return new ActionFormVariantDto(variant);
  }

  @Delete("form-variants/:variantId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFormVariantAdmin(
    @Param("variantId", ParseIntPipe) variantId: number,
  ): Promise<void> {
    await this.actionFormVariantService.deleteVariant(variantId);
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

  @Get("completed/:id")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async findCompletedForUser(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<ActionActivityDto[]> {
    return this.actionsService.findCompletedForUser(
      +id,
      comments,
      req.user?.sub,
    );
  }

  @Get("userFeed/:id")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [HomeFeedItemDto] })
  @ApiOperation({
    summary:
      "Get a single user's profile feed: their action completions interleaved with their forum comments (visibility-filtered for the requester)",
  })
  async userFeed(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
    @Query("comments", new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const page = parseFeedPage({ limit, before });

    return this.actionsService.userFeed(
      +id,
      req.user?.sub,
      page.limit,
      page.before,
      comments,
    );
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
      await this.userService.getCompletedActionCount(id),
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

  @Post("likeActivity/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async likeActivity(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionsService.likeActivity(id, req.user.sub);
    this.posthog.capture({
      event: AnalyticsEvent.ActivityLiked,
      distinctId: String(req.user.sub),
      properties: {
        activityId: id,
        activityType: activity.type,
      },
    });
    return activity;
  }

  @Post("unlikeActivity/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async unlikeActivity(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionsService.likeActivity(
      id,
      req.user.sub,
      true,
    );
    this.posthog.capture({
      event: AnalyticsEvent.ActivityUnliked,
      distinctId: String(req.user.sub),
      properties: {
        activityId: id,
        activityType: activity.type,
      },
    });
    return activity;
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

  @Get("suites")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto, isArray: true })
  async suitesAdmin(): Promise<ActionSuiteDto[]> {
    const suites = await this.actionsService.findSuites();
    return suites.map((suite) => new ActionSuiteDto(suite, []));
  }

  @Get("suite/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async suiteAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.findSuite(id);
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Post("createSuite")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async createSuiteAdmin(
    @Body() createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.createSuite(createActionSuiteDto);
    return new ActionSuiteDto(suite, []);
  }

  @Patch("suite/:suiteId/batchUpdateSuiteEvents/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  @ApiAcknowledgeDeadlineShortening()
  async batchUpdateSuiteEventsAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() body: UpdateActionEventDto,
    @AcknowledgeDeadlineShortening()
    acknowledgeDeadlineShortening: boolean,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.batchUpdateSuiteEvents({
      suiteId,
      eventId,
      body,
      acknowledgeDeadlineShortening,
    });
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Post("suite/:suiteId/events")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  @ApiAcknowledgeDeadlineShortening()
  async addSuiteEventAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Body() actionEventDto: CreateActionEventDto,
    @AcknowledgeDeadlineShortening()
    acknowledgeDeadlineShortening: boolean,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.addSuiteEvent({
      suiteId,
      event: actionEventDto,
      acknowledgeDeadlineShortening,
    });
    return new ActionSuiteDto(suite, suite.actions);
  }

  @Delete("suite/:suiteId/events/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async deleteSuiteEventAdmin(
    @Param("suiteId", ParseIntPipe) suiteId: number,
    @Param("eventId", ParseIntPipe) eventId: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.deleteSuiteEvent(suiteId, eventId);
    return new ActionSuiteDto(suite, suite.actions);
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
      this.actionsService.getSuspendPlans(start, end, 6),
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

  @Get("timeline-feed")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [TimelineFeedItemDto] })
  async getTimelineFeed(
    @Request() req: JwtRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<TimelineFeedItemDto[]> {
    return this.actionsService.getTimelineFeed(limit ?? 15, req.user?.sub);
  }
}
