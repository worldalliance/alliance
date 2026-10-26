import {
  ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
  type FeedActionActivity,
} from "@alliance/common/actionActivity";
import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { AuthOptionalGuard } from "src/auth/guards/authoptional.guard";
import type { JwtRequest } from "src/auth/tokens";
import { PosthogService } from "src/posthog/posthog.service";
import { ProfileDto } from "src/user/dto/user.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { ActionsService } from "./actions.service";
import { ActionActivityDto } from "./dto/action-activity.dto";
import {
  GlobalFeedItemDto,
  HomeFeedItemDto,
  TimelineFeedItemDto,
} from "./dto/action-feed.dto";
import { FeedMembersService } from "./feed-members.service";
import { parseFeedPage } from "./feed-page";
import { GlobalFeedService } from "./global-feed.service";

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
export class ActionFeedController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly feedMembers: FeedMembersService,
    private readonly globalFeed: GlobalFeedService,
    private readonly posthog: PosthogService,
  ) {}

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
    return this.globalFeed.getGlobalFeed(limit ?? 15, req.user?.sub);
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
    return this.feedMembers.getActivityGroupMembers(
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
    return this.feedMembers.getNewMembers(
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
    return this.feedMembers.getForumCommentMembers(
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

  @Get("timeline-feed")
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse({ type: [TimelineFeedItemDto] })
  async getTimelineFeed(
    @Request() req: JwtRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<TimelineFeedItemDto[]> {
    return this.globalFeed.getTimelineFeed(limit ?? 15, req.user?.sub);
  }
}
