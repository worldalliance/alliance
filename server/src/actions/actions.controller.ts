import { AnalyticsEvent } from '@alliance/common/analytics';
import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthOptionalGuard } from 'src/auth/guards/authoptional.guard';
import type { JwtRequest } from 'src/auth/guards/jwtreq';
import { CommentDto, CreateCommentDto } from 'src/forum/dto/comment.dto';
import { ActionEventReminderService } from 'src/notifs/action-event-reminder.service';
import { PreviewNotificationPlanDto } from 'src/notifs/dto/notification-plan.dto';
import { ActionEventNotifDto } from 'src/notifs/entities/action-event-notif.dto';
import { PosthogService } from 'src/posthog/posthog.service';
import { ShareLinkDto } from 'src/share-urls/dto/share-url.dto';
import { ShareUrlsService } from 'src/share-urls/share-urls.service';
import {
  CommunityUserInfoDto,
  UserActionRelationsResponseDto,
} from 'src/user/dto/user-action-relations.dto';
import { ProfileDto } from 'src/user/dto/user.dto';
import { UserService } from 'src/user/user.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Public } from '../auth/public.decorator';
import { ActionFormVariantService } from './action-form-variant.service';
import { ActionsService } from './actions.service';
import {
  ActionFormVariantDto,
  ActionFormVariantsListDto,
  CreateActionFormVariantDto,
  UpdateActionFormVariantDto,
} from './dto/action-form-variant.dto';
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  ActionReferralCodeDto,
  ActionSharePreviewDto,
  ActionSuiteDto,
  ActionUpdateDto,
  ActionWithdrawalDto,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionSuiteDto,
  CreateActionUpdateDto,
  CreateReminderGroupDto,
  EvaluateCohortExpressionDto,
  EvaluateCohortExpressionResponseDto,
  ExportActionDto,
  GlobalFeedActivityType,
  GlobalFeedActivityTypes,
  GlobalFeedItemDto,
  HomeFeedItemDto,
  OptOutActionDto,
  PasteJsonDto,
  PreviewEmailHtmlDto,
  PreviewEmailHtmlResponseDto,
  PreviewTextDto,
  PreviewTextMessageResponseDto,
  ReminderAnchorCandidateDto,
  ReminderGroupDto,
  ScheduledPlansOverviewDto,
  SetPriorityDto,
  SuspensionPlanDto,
  TimelineFeedItemDto,
  UnwelcomedSignedContractMemberDto,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionEventDto,
  UpdateActionUpdateDto,
  UserActionRelationDto,
} from './dto/action.dto';
import { CommunityCompletedActionsCountDto } from './dto/community-completed-actions-count.dto';
import {
  CreateFollowUpFormDto,
  FollowUpFormDto,
  UpdateFollowUpFormDto,
} from './dto/follow-up-form.dto';
import {
  CreateGeneralUpdateDto,
  GeneralUpdateAdminDto,
  GeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from './dto/general-update.dto';
import {
  NotificationScheduleEntryDto,
  NotificationScheduleQueryDto,
} from './dto/notification-schedule.dto';
import { ShareUrlDto, ShareUrlStatsDto } from './dto/share-url.dto';
import { UserCompletedActionsCountDto } from './dto/user-completed-actions-count.dto';
import { ForumActionCompleterWorker } from './forum-action-completer.worker';

const GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT = 30;
const GLOBAL_FEED_MEMBERS_MAX_LIMIT = 50;

function capGlobalFeedMembersLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), GLOBAL_FEED_MEMBERS_MAX_LIMIT);
}

function parseFeedActivityType(value: string): GlobalFeedActivityType {
  if ((GlobalFeedActivityTypes as readonly string[]).includes(value)) {
    return value as GlobalFeedActivityType;
  }
  throw new BadRequestException(`Invalid activityType: ${value}`);
}

@Controller('actions')
export class ActionsController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly forumActionCompleterWorker: ForumActionCompleterWorker,
    private readonly actionFormVariantService: ActionFormVariantService,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly posthog: PosthogService,
    private readonly userService: UserService,
  ) {}

  @Post('optout/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async optout(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OptOutActionDto,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionsService.withdrawFromAction(
      id,
      req.user.sub,
      {
        reason: body.reason,
        outOfTime: body.outOfTime,
        isMoral: body.isMoral,
      },
    );
    this.posthog.capture({
      event: AnalyticsEvent.ActionOptedOut,
      distinctId: String(req.user.sub),
      properties: {
        actionId: id,
      },
    });
    return new ActionActivityDto(activity);
  }

  @Post('complete/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async complete(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionsService.completeAction(id, req.user.sub);
    this.posthog.capture({
      event: AnalyticsEvent.ActionCompleted,
      distinctId: String(req.user.sub),
      properties: {
        actionId: id,
        actionType: activity.action?.type,
        actionName: activity.action?.name,
      },
    });
    return new ActionActivityDto(activity);
  }

  @Get('myStatus/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserActionRelationDto })
  @ApiOperation({
    summary: "Get the authenticated user's relation to a single action",
  })
  async myStatus(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserActionRelationDto> {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    const relation = await this.actionsService.getActionRelation(
      +id,
      req.user.sub,
    );
    if (!relation) {
      throw new NotFoundException('User action not found');
    }
    return new UserActionRelationDto(relation);
  }

  @Get()
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAll(@Request() req: JwtRequest): Promise<ActionDto[]> {
    return this.actionsService.findMemberPublic(req.user?.sub);
  }

  @Get('public')
  @Public()
  @ApiOkResponse({ type: [ActionDto] })
  async findPublicList(): Promise<ActionDto[]> {
    return this.actionsService.findPublicOnly();
  }

  @Get('loggedIn')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllLoggedIn(
    @Request() req: JwtRequest,
    @Query('sorted', new ParseBoolPipe({ optional: true })) sorted?: boolean,
  ): Promise<ActionDto[]> {
    return this.actionsService.findMemberPublic(req.user.sub, sorted);
  }

  @Get('myActivity')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async myActivity(@Request() req: JwtRequest): Promise<ActionActivityDto[]> {
    const activities = await this.actionsService.getActivityForUser(
      req.user?.sub,
    );
    return activities.map((activity) => new ActionActivityDto(activity));
  }

  @Get('generalUpdates')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [GeneralUpdateDto] })
  async allGeneralUpdates(): Promise<GeneralUpdateDto[]> {
    return (await this.actionsService.findAllGeneralUpdates()).map(
      (generalUpdate) => new GeneralUpdateDto(generalUpdate),
    );
  }

  @Get('generalUpdates/unread')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [GeneralUpdateDto] })
  async unreadGeneralUpdates(
    @Request() req: JwtRequest,
  ): Promise<GeneralUpdateDto[]> {
    return (
      await this.actionsService.findUnreadGeneralUpdates({
        userId: req.user.sub,
        now: new Date(),
        allowExpired: false,
      })
    ).map((generalUpdate) => new GeneralUpdateDto(generalUpdate));
  }

  @Post('generalUpdates/:generalUpdateId/dismiss')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async dismissGeneralUpdate(
    @Request() req: JwtRequest,
    @Param('generalUpdateId', ParseIntPipe) generalUpdateId: number,
  ): Promise<void> {
    return this.actionsService.dismissGeneralUpdate(
      req.user.sub,
      generalUpdateId,
    );
  }

  @Get('generalUpdates/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [GeneralUpdateAdminDto] })
  async allGeneralUpdatesAdmin(): Promise<GeneralUpdateAdminDto[]> {
    return (await this.actionsService.findAllGeneralUpdatesAdmin()).map(
      (generalUpdate) => new GeneralUpdateAdminDto(generalUpdate),
    );
  }

  @Get('generalUpdates/admin/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GeneralUpdateAdminDto })
  async findOneGeneralUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GeneralUpdateAdminDto> {
    return new GeneralUpdateAdminDto(
      await this.actionsService.findOneGeneralUpdate(id),
    );
  }

  @Post('generalUpdates/create')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GeneralUpdateAdminDto })
  async createGeneralUpdateAdmin(
    @Body() dto: CreateGeneralUpdateDto,
  ): Promise<GeneralUpdateAdminDto> {
    return new GeneralUpdateAdminDto(
      await this.actionsService.createGeneralUpdate(dto),
    );
  }

  @Patch('generalUpdates/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GeneralUpdateAdminDto })
  @ApiResponse({
    status: 409,
    description:
      'The general update was changed by someone else since it was opened (optimistic-concurrency conflict).',
  })
  async updateGeneralUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGeneralUpdateDto,
  ): Promise<GeneralUpdateAdminDto> {
    return new GeneralUpdateAdminDto(
      await this.actionsService.updateGeneralUpdate(id, dto),
    );
  }

  @Delete('generalUpdates/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteGeneralUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.actionsService.deleteGeneralUpdate(id);
  }

  @Get('activities/feed')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  @ApiOperation({
    summary: 'Get recent activities from all actions for the feed',
  })
  async getActivityFeed(
    @Request() req: JwtRequest,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<ActionActivityDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    const beforeDate = before ? new Date(before) : undefined;
    if (before && isNaN(beforeDate!.getTime())) {
      throw new BadRequestException('Invalid "before" cursor');
    }

    return await this.actionsService.getActivityFeed(
      limitNum,
      beforeDate,
      comments,
      req.user?.sub,
    );
  }

  @Get('globalFeed')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [GlobalFeedItemDto] })
  @ApiOperation({
    summary:
      'Get unified global feed with activities, updates, and new members',
  })
  async getGlobalFeed(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<GlobalFeedItemDto[]> {
    return this.actionsService.getGlobalFeed(limit ?? 15);
  }

  @Get('globalFeed/activityGroupMembers')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  @ApiOperation({
    summary: 'Paginated members behind a global-feed activity-group item',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'afterId', required: false, type: Number })
  async getGlobalFeedActivityMembers(
    @Query('actionId', ParseIntPipe) actionId: number,
    @Query('activityType') activityType: string,
    @Query(
      'limit',
      new DefaultValuePipe(GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
    @Query('afterId', new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return this.actionsService.getActivityGroupMembers(
      actionId,
      parseFeedActivityType(activityType),
      capGlobalFeedMembersLimit(limit),
      afterId,
    );
  }

  @Get('globalFeed/newMembers')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  @ApiOperation({
    summary: 'Paginated members behind the global-feed new-members item',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'afterId', required: false, type: Number })
  async getGlobalFeedNewMembers(
    @Query(
      'limit',
      new DefaultValuePipe(GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
    @Query('afterId', new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return this.actionsService.getNewMembers(
      capGlobalFeedMembersLimit(limit),
      afterId,
    );
  }

  @Get('globalFeed/forumCommentMembers')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  @ApiOperation({
    summary: 'Paginated members behind a global-feed forum-comments item',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'afterId', required: false, type: Number })
  async getGlobalFeedCommentMembers(
    @Request() req: JwtRequest,
    @Query('postId', ParseIntPipe) postId: number,
    @Query(
      'limit',
      new DefaultValuePipe(GLOBAL_FEED_MEMBERS_DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
    @Query('afterId', new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return this.actionsService.getForumCommentMembers(
      postId,
      capGlobalFeedMembersLimit(limit),
      afterId,
      req.user.sub,
    );
  }

  @Get('activities/:id')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async getActivity(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionActivityDto> {
    return this.actionsService.getActivity(id, req.user?.sub);
  }

  @Get('withdrawals/byForm/:formId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionWithdrawalDto, isArray: true })
  async getWithdrawalsAdmin(
    @Param('formId', ParseIntPipe) formId: number,
  ): Promise<ActionWithdrawalDto[]> {
    const activities = await this.actionsService.getWithdrawalsForForm(formId);
    return activities.map((a) => new ActionWithdrawalDto(a));
  }

  @Get('events/:id')
  @Public()
  @ApiOkResponse({ type: ActionEventDto })
  async getEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionEventDto> {
    return new ActionEventDto(await this.actionsService.getEvent(id));
  }

  @Get('notification-schedule')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: NotificationScheduleEntryDto, isArray: true })
  async getNotificationScheduleAdmin(
    @Query() query: NotificationScheduleQueryDto,
  ): Promise<NotificationScheduleEntryDto[]> {
    const start = new Date(query.windowStart);
    const end = new Date(query.windowEnd);

    const schedule =
      await this.actionEventReminderService.getNotificationSchedule(start, end);

    return schedule.map((entry) => new NotificationScheduleEntryDto(entry));
  }

  @Get(':id/activities')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  @ApiOperation({ summary: 'Get recent activities for an action' })
  async getActionActivities(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
    @Query('before') before?: string,
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

  @Post('priorities')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async setPriorityAdmin(@Body() dto: SetPriorityDto): Promise<void> {
    return this.actionsService.setPriorityOrder(dto);
  }

  @Get('all')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ActionDto] })
  async findAllWithDraftsAdmin(): Promise<ActionDto[]> {
    const actions = await this.actionsService.findAllSorted({
      events: true,
      suite: true,
    });
    return actions.map((action) => new ActionDto(action));
  }

  @Get('friendActivity/:actionId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async friendActivityForAction(
    @Param('actionId', ParseIntPipe) actionId: number,
    @Request() req: JwtRequest,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
    @Query('limit', new ParseIntPipe({ optional: true }))
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

  @Get('friendActivity')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async friendActivity(
    @Request() req: JwtRequest,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: string,
    @Query('before') before?: string,
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

  @Get('homeFeed')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [HomeFeedItemDto] })
  @ApiOperation({
    summary:
      'Get contentful completions from friends and group members, interleaved with cluster-mate forum comments on cluster-tagged posts',
  })
  async homeFeed(
    @Request() req: JwtRequest,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    const beforeDate = before ? new Date(before) : undefined;
    if (before && isNaN(beforeDate!.getTime())) {
      throw new BadRequestException('Invalid "before" cursor');
    }

    return this.actionsService.homeFeed(
      req.user.sub,
      limitNum,
      beforeDate,
      comments,
    );
  }

  @Get('communityActivity')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async communityActivity(
    @Request() req: JwtRequest,
    @Query('communityId', ParseIntPipe) communityId: number,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<ActionActivityDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    const beforeDate = before ? new Date(before) : undefined;
    if (before && isNaN(beforeDate!.getTime())) {
      throw new BadRequestException('Invalid "before" cursor');
    }

    return this.actionsService.communityActivity(
      limitNum,
      beforeDate,
      communityId,
      comments,
      req.user.sub,
    );
  }

  @Get('communityCompletedActionsCount')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary:
      'Count of member action completions for current members of a community',
  })
  @ApiOkResponse({ type: CommunityCompletedActionsCountDto })
  @ApiQuery({ name: 'communityId', type: Number })
  async communityCompletedActionsCount(
    @Request() req: JwtRequest,
    @Query('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityCompletedActionsCountDto> {
    return new CommunityCompletedActionsCountDto(
      await this.actionsService.countCommunityCompletedActions(
        req.user.sub,
        communityId,
      ),
    );
  }

  @Get('slug/:id')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionDto> {
    return this.actionsService.findOneDto(id, req.user?.sub);
  }

  @Get(':id/sharePreview')
  @Public()
  @ApiQuery({ name: 'sid', required: false, type: String })
  @ApiQuery({
    name: 'ref',
    required: false,
    type: String,
    deprecated: true,
    description: 'Deprecated alias for `sid`; retained for older clients.',
  })
  @ApiOkResponse({ type: ActionSharePreviewDto })
  async getSharePreview(
    @Param('id', ParseIntPipe) id: number,
    @Query('sid') sid?: string,
    @Query('ref') ref?: string,
  ): Promise<ActionSharePreviewDto> {
    return new ActionSharePreviewDto(
      await this.actionsService.getSharePreview(id, sid ?? ref),
    );
  }

  @Post(':id/referralCode')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionReferralCodeDto })
  async getActionReferralCode(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionReferralCodeDto> {
    return new ActionReferralCodeDto(
      await this.actionsService.getOrCreateActionReferralCode(id, req.user.sub),
    );
  }

  @Get('adminslug/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  @ApiUnauthorizedResponse()
  async findOneAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionDto> {
    return new ActionDto(
      await this.actionsService.findOneOrFail({
        id,
        userId: req.user.sub,
        includeUnpublishedUpdates: true,
      }),
    );
  }

  @Get(':id/follow-up-forms')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FollowUpFormDto] })
  async getFollowUpFormsAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FollowUpFormDto[]> {
    const action = await this.actionsService.findOneOrFail({
      id,
      serverSide: true,
    });
    const list = action.followUpForms ?? [];
    return list.map((f) => new FollowUpFormDto(f));
  }

  @Post(':id/follow-up-forms')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FollowUpFormDto })
  async createFollowUpFormAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFollowUpFormDto,
  ): Promise<FollowUpFormDto> {
    const created = await this.actionsService.createFollowUpForm(id, dto);
    const withForm = await this.actionsService.findOneOrFail({
      id,
      serverSide: true,
    });
    const found = withForm.followUpForms?.find((f) => f.id === created.id);
    return new FollowUpFormDto(found ?? created);
  }

  @Patch('follow-up-forms/:followUpFormId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: FollowUpFormDto })
  async updateFollowUpFormAdmin(
    @Param('followUpFormId', ParseIntPipe) followUpFormId: number,
    @Body() dto: UpdateFollowUpFormDto,
  ): Promise<FollowUpFormDto> {
    const updated = await this.actionsService.updateFollowUpForm(
      followUpFormId,
      dto,
    );
    return new FollowUpFormDto(updated);
  }

  @Delete('follow-up-forms/:followUpFormId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFollowUpFormAdmin(
    @Param('followUpFormId', ParseIntPipe) followUpFormId: number,
  ): Promise<void> {
    return this.actionsService.deleteFollowUpForm(followUpFormId);
  }

  @Get(':id/incomplete-users')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async getIncompleteUsersAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProfileDto[]> {
    const users = await this.actionsService.findIncompleteUsersForAction(id);
    return users.map((user) => new ProfileDto(user));
  }

  @Get(':id/completed-users')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async getCompletedUsersAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProfileDto[]> {
    const users = await this.actionsService.findCompletedUsersForAction(id);
    return users.map((user) => new ProfileDto(user));
  }

  @Get('welcome-queue')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UnwelcomedSignedContractMemberDto] })
  async getUnwelcomedSignedContractMembersAdmin(): Promise<
    UnwelcomedSignedContractMemberDto[]
  > {
    return (
      await this.actionsService.findUnwelcomedSignedContractMembers()
    ).map((member) => new UnwelcomedSignedContractMemberDto(member));
  }

  @Post('evaluate-cohort')
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

  @Get(':id/form-variants')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantsListDto })
  async listFormVariantsAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionFormVariantsListDto> {
    const [variants, stats] = await Promise.all([
      this.actionFormVariantService.listForAction(id),
      this.actionFormVariantService.getStatsForAction(id),
    ]);
    return new ActionFormVariantsListDto(variants, stats);
  }

  @Post(':id/form-variants')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantDto })
  async createFormVariantAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateActionFormVariantDto,
  ): Promise<ActionFormVariantDto> {
    const variant = await this.actionFormVariantService.createVariant(id, body);
    return new ActionFormVariantDto(variant);
  }

  @Patch('form-variants/:variantId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionFormVariantDto })
  async updateFormVariantAdmin(
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: UpdateActionFormVariantDto,
  ): Promise<ActionFormVariantDto> {
    const variant = await this.actionFormVariantService.updateVariant(
      variantId,
      body,
    );
    return new ActionFormVariantDto(variant);
  }

  @Delete('form-variants/:variantId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteFormVariantAdmin(
    @Param('variantId', ParseIntPipe) variantId: number,
  ): Promise<void> {
    await this.actionFormVariantService.deleteVariant(variantId);
  }

  @Post('create')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  async createAdmin(
    @Body() createActionDto: CreateActionDto,
  ): Promise<ActionDto> {
    return new ActionDto(await this.actionsService.create(createActionDto));
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  async updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateActionDto: UpdateActionDto,
    @Request() req: JwtRequest,
  ): Promise<ActionDto> {
    return new ActionDto(
      await this.actionsService.update(id, updateActionDto, req.user.sub),
    );
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  removeAdmin(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.actionsService.remove(id);
  }

  @Get('completed/:id')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [ActionActivityDto] })
  async findCompletedForUser(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<ActionActivityDto[]> {
    return this.actionsService.findCompletedForUser(
      +id,
      comments,
      req.user?.sub,
    );
  }

  @Get('userFeed/:id')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [HomeFeedItemDto] })
  @ApiOperation({
    summary:
      "Get a single user's profile feed: their action completions interleaved with their forum comments (visibility-filtered for the requester)",
  })
  async userFeed(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('comments', new ParseBoolPipe({ optional: true }))
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const limitNum = limit ? parseInt(limit) : 20;
    const beforeDate = before ? new Date(before) : undefined;
    if (before && isNaN(beforeDate!.getTime())) {
      throw new BadRequestException('Invalid "before" cursor');
    }

    return this.actionsService.userFeed(
      +id,
      req.user?.sub,
      limitNum,
      beforeDate,
      comments,
    );
  }

  @Get('userCompletedCount/:id')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: UserCompletedActionsCountDto })
  @ApiOperation({
    summary:
      "Total count of a user's completed-action activities (independent of feed pagination)",
  })
  async userCompletedCount(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserCompletedActionsCountDto> {
    return new UserCompletedActionsCountDto(
      await this.userService.getCompletedActionCount(id),
    );
  }

  @Post(':id/events')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionEventDto })
  async addEventAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionEventDto: CreateActionEventDto,
    @Request() req: JwtRequest,
  ): Promise<ActionEventDto> {
    return new ActionEventDto(
      await this.actionsService.addEvent(id, actionEventDto, req.user?.sub),
    );
  }

  @Patch('remindergroups/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroupDto })
  async updateReminderGroupAdmin(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: CreateReminderGroupDto,
  ): Promise<ReminderGroupDto> {
    return new ReminderGroupDto(
      await this.actionEventReminderService.updateReminderGroup(groupId, body),
    );
  }

  @Post('events/:eventId/createremindergroup')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroupDto })
  async createReminderGroupAdmin(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: CreateReminderGroupDto,
  ): Promise<ReminderGroupDto> {
    return new ReminderGroupDto(
      await this.actionEventReminderService.createReminderGroup(eventId, body),
    );
  }

  @Delete('reminders/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteReminderGroupAdmin(
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<void> {
    await this.actionEventReminderService.deleteReminderGroup(groupId);
  }

  @Get('plansForGroup/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewNotificationPlanDto, isArray: true })
  async plansForGroupAdmin(
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<PreviewNotificationPlanDto[]> {
    return this.actionEventReminderService.findNotificationPlansForGroup(
      groupId,
    );
  }

  @Get('sentNotifsForGroup/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionEventNotifDto, isArray: true })
  async sentNotifsForGroupAdmin(
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<ActionEventNotifDto[]> {
    return this.actionEventReminderService.getSentNotifsForGroup(groupId);
  }

  @Post('clearDb')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  clearDbAdmin(): Promise<void> {
    return this.actionsService.clearDb();
  }

  @Post('likeActivity/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async likeActivity(
    @Param('id', ParseIntPipe) id: number,
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

  @Post('unlikeActivity/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async unlikeActivity(
    @Param('id', ParseIntPipe) id: number,
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

  @Post('addActivityComment/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommentDto })
  async addActivityComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() commentDto: CreateCommentDto,
    @Request() req: JwtRequest,
  ): Promise<CommentDto> {
    const comment = await this.actionsService.addActivityComment(
      id,
      commentDto,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.ActivityCommentCreated,
      distinctId: String(req.user.sub),
      properties: { activityId: id, commentId: comment.id },
    });
    return comment;
  }

  @Post('updateActivity/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async updateActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() activityDto: UpdateActionActivityDto,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    return this.actionsService.updateActivity(id, activityDto, req.user.sub);
  }

  @Post('dismiss/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async dismissAction(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ActionActivityDto> {
    return new ActionActivityDto(
      await this.actionsService.dismissAction(req.user.sub, id),
    );
  }

  @Post('createActivity')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionActivityDto })
  async createActivityAdmin(
    @Body() activityDto: CreateActionActivityDto,
  ): Promise<ActionActivityDto> {
    return new ActionActivityDto(
      await this.actionsService.adminCreateActivity(activityDto),
    );
  }

  @Post('archive/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  async archiveAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionDto> {
    return new ActionDto(await this.actionsService.archive(id));
  }

  @Post('unarchive/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  async unarchiveAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionDto> {
    return new ActionDto(await this.actionsService.unarchive(id));
  }

  @Get('reminderGroupsForEvent/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroupDto, isArray: true })
  async reminderGroupsForEventAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReminderGroupDto[]> {
    const groups =
      await this.actionEventReminderService.getReminderGroupsForEvent(id);
    return groups.map((group) => new ReminderGroupDto(group));
  }

  @Get('reminderAnchorCandidates/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderAnchorCandidateDto, isArray: true })
  async reminderAnchorCandidatesAdmin(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ReminderAnchorCandidateDto[]> {
    const candidates =
      await this.actionsService.findReminderAnchorCandidates(eventId);
    return candidates.map(
      (candidate) => new ReminderAnchorCandidateDto(candidate),
    );
  }

  @Post('createUpdate/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionUpdateDto })
  async createUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<ActionUpdateDto> {
    return new ActionUpdateDto(
      await this.actionsService.createActionUpdate(id, createActionUpdateDto),
    );
  }

  @Get('updates/admin/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionUpdateDto })
  async findOneUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionUpdateDto> {
    return new ActionUpdateDto(
      await this.actionsService.findOneActionUpdate(id),
    );
  }

  @Patch('updateUpdate/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionUpdateDto })
  @ApiResponse({
    status: 409,
    description:
      'The update was changed by someone else since the editor loaded it.',
  })
  async updateUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateActionUpdateDto: UpdateActionUpdateDto,
  ): Promise<ActionUpdateDto> {
    return new ActionUpdateDto(
      await this.actionsService.updateActionUpdate(id, updateActionUpdateDto),
    );
  }

  @Post('updates/:id/notify')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActionUpdateDto })
  @ApiResponse({
    status: 409,
    description: 'The update has already been notified about.',
  })
  async notifyUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionUpdateDto> {
    return new ActionUpdateDto(
      await this.actionsService.notifyActionUpdate(id),
    );
  }

  @Delete('deleteUpdate/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteUpdateAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.actionsService.deleteActionUpdate(id);
  }

  @Get('allUpdates')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionUpdateDto, isArray: true })
  async allUpdates(): Promise<ActionUpdateDto[]> {
    const updates = await this.actionsService.getActionUpdates();
    return updates.map((update) => new ActionUpdateDto(update));
  }

  @Get('updates')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ActionUpdateDto, isArray: true })
  async recentUpdates(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ActionUpdateDto[]> {
    const updates = await this.actionsService.getActionUpdates(limit ?? 20);
    return updates.map((update) => new ActionUpdateDto(update));
  }

  @Get('suites')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto, isArray: true })
  async suitesAdmin(): Promise<ActionSuiteDto[]> {
    const suites = await this.actionsService.findSuites();
    return suites.map((suite) => new ActionSuiteDto(suite, []));
  }

  @Get('suite/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async suiteAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.findSuite(id);
    return new ActionSuiteDto(suite);
  }

  @Post('createSuite')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async createSuiteAdmin(
    @Body() createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.createSuite(createActionSuiteDto);
    return new ActionSuiteDto(suite, []);
  }

  @Patch('suite/:suiteId/batchUpdateSuiteEvents/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async batchUpdateSuiteEventsAdmin(
    @Param('suiteId', ParseIntPipe) suiteId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: UpdateActionEventDto,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.batchUpdateSuiteEvents(
      suiteId,
      eventId,
      body,
    );
    return new ActionSuiteDto(suite);
  }

  @Post('suite/:suiteId/events')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async addSuiteEventAdmin(
    @Param('suiteId', ParseIntPipe) suiteId: number,
    @Body() actionEventDto: CreateActionEventDto,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.addSuiteEvent(
      suiteId,
      actionEventDto,
    );
    return new ActionSuiteDto(suite);
  }

  @Delete('suite/:suiteId/events/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionSuiteDto })
  async deleteSuiteEventAdmin(
    @Param('suiteId', ParseIntPipe) suiteId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ActionSuiteDto> {
    const suite = await this.actionsService.deleteSuiteEvent(suiteId, eventId);
    return new ActionSuiteDto(suite);
  }

  @Post('events/:eventId/checkTentativePlans')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewNotificationPlanDto, isArray: true })
  async tentativePlansForGroupAdmin(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: CreateReminderGroupDto,
  ): Promise<PreviewNotificationPlanDto[]> {
    return this.actionsService.tentativePlansForGroup(eventId, body);
  }

  @Post('previewEmailHtml/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewEmailHtmlResponseDto })
  async previewEmailHtmlAdmin(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: PreviewEmailHtmlDto,
  ): Promise<PreviewEmailHtmlResponseDto> {
    return new PreviewEmailHtmlResponseDto(
      await this.actionEventReminderService.previewEmailHtml(eventId, body),
    );
  }

  @Post('previewTextMessage/:eventId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewTextMessageResponseDto })
  async previewTextMessageAdmin(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: PreviewTextDto,
  ): Promise<PreviewTextMessageResponseDto> {
    return new PreviewTextMessageResponseDto(
      await this.actionEventReminderService.previewTextMessage(eventId, body),
    );
  }

  @Get('reloadAllActionUsersJoined')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async reloadAllActionUsersJoinedAdmin(): Promise<void> {
    return this.actionsService.reloadAllActionUsersJoined();
  }

  @Get('reloadAllActionUsersCompleted')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async reloadAllActionUsersCompletedAdmin(): Promise<void> {
    return this.actionsService.reloadAllActionUsersCompleted();
  }

  @Get('export/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ExportActionDto })
  async exportActionAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Query('events', new ParseBoolPipe({ optional: true })) events?: boolean,
    @Query('taskForm', new ParseBoolPipe({ optional: true }))
    taskForm?: boolean,
    @Query('reminders', new ParseBoolPipe({ optional: true }))
    reminders?: boolean,
    @Query('suite', new ParseBoolPipe({ optional: true })) suite?: boolean,
  ): Promise<ExportActionDto> {
    return this.actionsService.exportAction(
      id,
      events,
      reminders,
      taskForm,
      suite,
    );
  }

  @Post('pasteJson')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionDto })
  async pasteJsonAdmin(@Body() body: PasteJsonDto): Promise<ActionDto> {
    return new ActionDto(await this.actionsService.importAction(body.body));
  }

  @Get('scheduledPlans')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ScheduledPlansOverviewDto })
  async scheduledPlansAdmin(
    @Query('rangeStart') rangeStart: Date,
    @Query('rangeEnd') rangeEnd: Date,
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

  @Get('suspendPlans')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: SuspensionPlanDto, isArray: true })
  async suspendPlansAdmin(
    @Query('rangeStart') rangeStart: Date,
    @Query('rangeEnd') rangeEnd: Date,
  ): Promise<SuspensionPlanDto[]> {
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    const plans = await this.actionsService.getSuspendPlans(start, end, 6);
    return plans.map((plan) => new SuspensionPlanDto(plan));
  }

  @Post('getShareLink/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated. Use POST /share-urls/get-share-link instead.',
  })
  @ApiOkResponse({ type: ShareLinkDto })
  async getShareLink(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<ShareLinkDto> {
    const url = await this.shareUrlsService.getShareLink({
      userId: req.user.sub,
      actionId: id,
    });
    return new ShareLinkDto(url);
  }

  @Get('shareLinksForForm/:formId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlDto, isArray: true })
  async shareLinksForFormAdmin(
    @Param('formId', ParseIntPipe) formId: number,
  ): Promise<ShareUrlDto[]> {
    const shareUrls = await this.actionsService.getShareLinksForForm(formId);
    return shareUrls.map((shareUrl) => new ShareUrlDto(shareUrl));
  }

  @Get('shareUrlStats/:actionId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlStatsDto, isArray: true })
  @ApiQuery({ name: 'questionId', required: false, type: String })
  async shareUrlStatsAdmin(
    @Param('actionId', ParseIntPipe) actionId: number,
    @Query('questionId') questionId?: string,
  ): Promise<ShareUrlStatsDto[]> {
    const stats = await this.actionsService.getShareUrlStats(
      actionId,
      questionId,
    );
    return stats.map((stat) => new ShareUrlStatsDto(stat));
  }

  // TODO move ====================================
  @Get('action-relations')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserActionRelationsResponseDto })
  async actionRelationsAdmin(): Promise<UserActionRelationsResponseDto> {
    return new UserActionRelationsResponseDto(
      await this.actionsService.findUserActionRelations(),
    );
  }

  @Get('action-relations/:userId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserActionRelationsResponseDto })
  async actionRelationsForUserAdmin(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserActionRelationsResponseDto> {
    return new UserActionRelationsResponseDto(
      await this.actionsService.findUserActionRelationsForUser(userId),
    );
  }

  @Get('communityMemberInfo/:communityId/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityUserInfoDto })
  async getCommunityMemberInfoAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityUserInfoDto> {
    return new CommunityUserInfoDto(
      await this.actionsService.findMemberInfoByCommunityId(communityId),
    );
  }

  @Get('communityMemberInfo/:communityId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityUserInfoDto })
  async getCommunityMemberInfo(
    @Request() req: JwtRequest,
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityUserInfoDto> {
    return new CommunityUserInfoDto(
      await this.actionsService.findMemberInfo(req.user.sub, communityId),
    );
  }

  @Get('timeline-feed')
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [TimelineFeedItemDto] })
  async getTimelineFeed(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<TimelineFeedItemDto[]> {
    return this.actionsService.getTimelineFeed(limit ?? 15);
  }
}
