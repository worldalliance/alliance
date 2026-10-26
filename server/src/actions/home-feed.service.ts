import { ACTION_ACTIVITY_FEED_VISIBLE_TYPES } from "@alliance/common/actionActivity";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommunityService } from "src/community/community.service";
import { ForumCommentQueryService } from "src/forum/forum-comment-query.service";
import { type ParsedFormResponse } from "src/tasks/entities/formresponse.entity";
import { loadedUserCommunities } from "src/user/entities/user.entity";
import { In, LessThan, type Repository } from "typeorm";
import { FriendService } from "../user/friend.service";
import { UserService } from "../user/user.service";
import { ActionVisibilityService } from "./action-visibility.service";
import { ActivityFeedService } from "./activity-feed.service";
import { ActivityOutputService } from "./activity-output.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import {
  HomeFeedItem,
  HomeFeedItemDto,
  HomeFeedItemType,
} from "./dto/action-feed.dto";
import { ActionActivity } from "./entities/action-activity.entity";

/**
 * Below this many active friends + group members, the feed is topped up with other
 * active members so a thin network still has something to read.
 */
const MIN_HOME_FEED_SOURCE_USERS = 10;

@Injectable()
export class HomeFeedService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly userService: UserService,
    private readonly friendService: FriendService,
    private readonly communityService: CommunityService,
    private readonly forumCommentQueryService: ForumCommentQueryService,
    private readonly actionVisibility: ActionVisibilityService,
    private readonly activityOutput: ActivityOutputService,
    private readonly activityFeed: ActivityFeedService,
  ) {}

  async homeFeed(
    userId: number,
    limit: number = 20,
    before?: Date,
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const [friends, user] = await Promise.all([
      this.friendService.findFriends(userId),
      this.userService.findOne(userId, { communities: true }),
    ]);
    if (!user) throw new NotFoundException("User not found");

    const friendIds = friends.map((f) => f.id);
    const communityIds = loadedUserCommunities(user).map((c) => c.id);
    const userClusterId = user.clusterId;

    // Get community member IDs in batch
    const communityMemberIds = new Set<number>();
    if (communityIds.length > 0) {
      const communities = await Promise.all(
        communityIds.map((id) => this.communityService.findOneOrFail(id)),
      );
      for (const community of communities) {
        for (const member of community.users ?? []) {
          communityMemberIds.add(member.id);
        }
      }
    }

    const knownIds = new Set([...friendIds, ...communityMemberIds]);
    knownIds.delete(userId);
    const activeKnownCount = await this.userService.countActiveUsers([
      ...knownIds,
    ]);
    // Seeded by viewer, so the fillers stay the same across pages and visits.
    const fillerIds = await this.userService.pickActiveUserIdsForSeed({
      count: MIN_HOME_FEED_SOURCE_USERS - activeKnownCount,
      excludeIds: [...knownIds, userId],
      seed: String(userId),
    });

    const allUserIds = [...knownIds, ...fillerIds, userId];

    const visibilityUser =
      await this.actionVisibility.loadUserForActionVisibility(userId);
    const visibilitySession = new CohortResolutionSession();

    const forumComments =
      await this.forumCommentQueryService.findForumCommentsForFeed({
        userId,
        userClusterId,
        sourceUserIds: allUserIds,
        limit,
        before,
      });
    const forumCommentItems: HomeFeedItem[] = forumComments.map((fc) => ({
      type: HomeFeedItemType.ForumComment,
      date: fc.comment.createdAt,
      forumComment: fc,
    }));
    const forumCommentDateMs = forumCommentItems
      .map((c) => c.date.getTime())
      .sort((a, b) => b - a);

    const batchSize = limit * 2;
    const contentful: ActionActivity[] = [];
    const outputs = new Map<number, ParsedFormResponse>();
    let cursor = before;

    while (contentful.length < limit && allUserIds.length > 0) {
      const batch = await this.activityFeed.fetchActivityFeed({
        limit: batchSize,
        before: cursor,
        userIds: allUserIds,
        requireFormResponse: true,
      });

      const visibleIds = await this.actionVisibility.visibleActionIdsForUser({
        actionIds: batch.map((activity) => activity.actionId),
        user: visibilityUser,
        session: visibilitySession,
      });

      for (const a of batch) {
        if (!visibleIds.has(a.actionId)) {
          continue;
        }
        const output = this.activityOutput.buildOutputFormResponse(a);
        if (output) {
          contentful.push(a);
          outputs.set(a.id, output);
          if (contentful.length >= limit) break;
        }
      }

      if (batch.length < batchSize) break;

      cursor = batch[batch.length - 1].createdAt;

      const cursorMs = cursor.getTime();
      const commentsNewerThanCursor = forumCommentDateMs.filter(
        (d) => d > cursorMs,
      ).length;
      if (contentful.length + commentsNewerThanCursor >= limit) break;
    }

    const activityDtos = await this.activityFeed.toDetailedActivityDtos({
      activities: contentful,
      requestingUserId: userId,
      comments: !!comments,
      outputs,
    });

    const activityItems = activityDtos.map(
      (activity): HomeFeedItem => ({
        type: HomeFeedItemType.Activity,
        date: activity.createdAt,
        activity,
      }),
    );

    const merged: HomeFeedItem[] = [...activityItems, ...forumCommentItems];
    merged.sort((a, b) => b.date.getTime() - a.date.getTime());

    return merged.slice(0, limit).map((item) => new HomeFeedItemDto(item));
  }

  async userFeed(
    userId: number,
    requestingUserId?: number,
    limit: number = 20,
    before?: Date,
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const [rawActivities, forumComments] = await Promise.all([
      this.actionActivityRepository.find({
        where: {
          userId,
          type: In(ACTION_ACTIVITY_FEED_VISIBLE_TYPES),
          ...(before ? { createdAt: LessThan(before) } : {}),
        },
        relations: {
          action: true,
          user: true,
          taskFormResponse: { formSnapshot: true },
        },
        order: { createdAt: "DESC" },
        take: limit * 3,
      }),
      this.forumCommentQueryService.findForumCommentsByUserForFeed({
        authorId: userId,
        requestingUserId,
        limit,
        before,
      }),
    ]);

    const visibleIds = await this.actionVisibility.visibleActionIdsForUser({
      actionIds: rawActivities.map((activity) => activity.actionId),
      userId: requestingUserId,
    });
    const activities = rawActivities
      .filter((activity) => visibleIds.has(activity.actionId))
      .slice(0, limit);

    const activityDtos = await this.activityFeed.toDetailedActivityDtos({
      activities,
      requestingUserId,
      comments: !!comments,
    });

    const activityItems = activityDtos.map(
      (activity): HomeFeedItem => ({
        type: HomeFeedItemType.Activity,
        date: activity.createdAt,
        activity,
      }),
    );
    const forumCommentItems: HomeFeedItem[] = forumComments.map((fc) => ({
      type: HomeFeedItemType.ForumComment,
      date: fc.comment.createdAt,
      forumComment: fc,
    }));

    const merged: HomeFeedItem[] = [...activityItems, ...forumCommentItems];
    merged.sort((a, b) => b.date.getTime() - a.date.getTime());

    return merged.slice(0, limit).map((item) => new HomeFeedItemDto(item));
  }
}
