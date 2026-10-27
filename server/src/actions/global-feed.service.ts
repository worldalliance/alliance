import {
  ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
  type FeedActionActivity,
} from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Comment,
  CommentParentObject,
  loadedCommentAuthor,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { ForumService } from "src/forum/forum.service";
import { withoutHiddenComments } from "src/forum/hidden-comments";
import { displayOnlySchemaOf } from "src/tasks/display-only-snapshot";
import { ProfileDto } from "src/user/dto/user.dto";
import { MoreThan, Not, type Repository } from "typeorm";
import {
  isActionUpdatePublished,
  publishedActionUpdateWhere,
} from "./action-update-visibility";
import { ActionVisibilityService } from "./action-visibility.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import {
  GlobalFeedActionUpdateDto,
  GlobalFeedActivityGroupDto,
  GlobalFeedForumCommentsDto,
  GlobalFeedItemDto,
  GlobalFeedItemType,
  GlobalFeedNewMembersDto,
  TimelineFeedItemDto,
  TimelineFeedItemType,
} from "./dto/action-feed.dto";
import {
  ActionActivity,
  loadedActionActivityAction,
  loadedActionActivityUser,
} from "./entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
  loadedActionEventAction,
} from "./entities/action-event.entity";
import { ActionUpdate } from "./entities/action-update.entity";
import { parseAction } from "./entities/action.entity";
import {
  FeedMembersService,
  GLOBAL_FEED_FACEPILE_LIMIT,
  globalFeedWindowStart,
} from "./feed-members.service";

@Injectable()
export class GlobalFeedService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly actionVisibility: ActionVisibilityService,
    private readonly forumService: ForumService,
    private readonly feedMembers: FeedMembersService,
  ) {}

  /** Unified feed of recent activity groups, action updates, joins, and comments. */
  async getGlobalFeed(
    limit: number = 15,
    userId?: number,
  ): Promise<GlobalFeedItemDto[]> {
    const feedItems: GlobalFeedItemDto[] = [];
    const now = new Date();
    const oneWeekAgo = globalFeedWindowStart();
    const session = new CohortResolutionSession();
    const user =
      await this.actionVisibility.loadUserForActionVisibility(userId);

    const recentActivities = (await this.actionActivityRepository
      .createQueryBuilder("activity")
      .leftJoinAndSelect("activity.user", "user")
      .leftJoinAndSelect("activity.action", "action")
      .select([
        "activity.id",
        "activity.type",
        "activity.actionId",
        "activity.createdAt",
        "user.id",
        "user.name",
        "user.profilePicture",
        "user.anonymous",
        "user.admin",
        "user.staff",
        "user.profileDescription",
        "action.id",
        "action.name",
        "action.onboarding",
      ])
      .loadRelationIdAndMap("user.leaderOfIds", "user.leaderOf")
      .where("activity.type IN (:...types)", {
        types: ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
      })
      .andWhere("action.onboarding = false")
      .andWhere("activity.createdAt > :oneWeekAgo", { oneWeekAgo })
      .orderBy("activity.createdAt", "DESC")
      .getMany()) as (ActionActivity & {
      type: FeedActionActivity;
    })[];

    // The recency window runs on `visibleAt`, not `date`: an update backdated to
    // when its subject happened would fall outside a one-week window on the day
    // it was published.
    const actionUpdates = await this.actionUpdateRepository.find({
      where: {
        visibleAt: MoreThan(oneWeekAgo),
      },
      relations: { action: true, schemaSnapshot: true },
      order: { date: "DESC" },
    });

    const visibleActionIds =
      await this.actionVisibility.visibleActionIdsForUser({
        actionIds: [
          ...recentActivities.map((activity) => activity.actionId),
          ...actionUpdates.map((update) => update.actionId),
        ],
        user,
        session,
      });

    // Activity groups are action + type, not day buckets.
    const activityGroups = new Map<
      string,
      {
        activities: ActionActivity[];
        actionId: number;
        actionName: string;
        type: FeedActionActivity;
        latestDate: Date;
      }
    >();

    for (const activity of recentActivities) {
      if (!visibleActionIds.has(activity.actionId)) {
        continue;
      }
      const key = `${activity.actionId}-${activity.type}`;

      if (!activityGroups.has(key)) {
        activityGroups.set(key, {
          activities: [],
          actionId: activity.actionId,
          actionName: loadedActionActivityAction(activity).name,
          type: activity.type,
          latestDate: activity.createdAt,
        });
      }
      const group = activityGroups.get(key)!;
      group.activities.push(activity);
      if (activity.createdAt > group.latestDate) {
        group.latestDate = activity.createdAt;
      }
    }

    for (const group of activityGroups.values()) {
      const uniqueUsers = new Map<number, ProfileDto>();
      for (const activity of group.activities) {
        const activityUser = loadedActionActivityUser(activity);
        if (!uniqueUsers.has(activityUser.id)) {
          uniqueUsers.set(activityUser.id, new ProfileDto(activityUser));
        }
      }
      const users = Array.from(uniqueUsers.values());

      const activityGroup: GlobalFeedActivityGroupDto = {
        users: users.slice(0, GLOBAL_FEED_FACEPILE_LIMIT),
        actionId: group.actionId,
        actionName: group.actionName,
        activityType: group.type,
        count: uniqueUsers.size,
      };

      feedItems.push(
        new GlobalFeedItemDto({
          type: GlobalFeedItemType.ActivityGroup,
          date: group.latestDate,
          activityGroup,
        }),
      );
    }

    for (const update of actionUpdates) {
      if (!visibleActionIds.has(update.actionId)) {
        continue;
      }
      if (isActionUpdatePublished(update, now) && update.schemaSnapshot) {
        const actionUpdateDto: GlobalFeedActionUpdateDto = {
          id: update.id,
          title: update.title,
          schema: displayOnlySchemaOf({
            owner: "ActionUpdate",
            ownerId: update.id,
            snapshot: update.schemaSnapshot,
          }),
          date: update.date,
          actionId: update.actionId,
          actionName: update.action?.name || "Unknown Action",
        };

        feedItems.push(
          new GlobalFeedItemDto({
            type: GlobalFeedItemType.ActionUpdate,
            date: update.date,
            actionUpdate: actionUpdateDto,
          }),
        );
      }
    }

    const {
      users: newMemberUsers,
      count: newMemberCount,
      latestDate: latestMemberDate,
    } = await this.feedMembers.computeRecentNewMembers(oneWeekAgo, now);

    if (newMemberCount > 0 && latestMemberDate) {
      const newMembers: GlobalFeedNewMembersDto = {
        users: newMemberUsers,
        count: newMemberCount,
      };

      feedItems.push(
        new GlobalFeedItemDto({
          type: GlobalFeedItemType.NewMembers,
          date: latestMemberDate,
          newMembers,
        }),
      );
    }

    const recentComments = await withoutHiddenComments(
      this.commentRepository.manager,
      await this.commentRepository
        .createQueryBuilder("comment")
        .leftJoinAndSelect("comment.author", "author")
        .select([
          "comment.id",
          "comment.parentObjectId",
          "comment.parentObjectType",
          "comment.createdAt",
          "author.id",
          "author.name",
          "author.profilePicture",
          "author.anonymous",
          "author.admin",
          "author.staff",
          "author.profileDescription",
        ])
        .loadRelationIdAndMap("author.leaderOfIds", "author.leaderOf")
        .where("comment.parentObjectType = :postType", {
          postType: CommentParentObject.Post,
        })
        .andWhere("comment.createdAt > :oneWeekAgo", { oneWeekAgo })
        .orderBy("comment.createdAt", "DESC")
        .getMany(),
    );

    const commentGroups = new Map<
      number,
      {
        users: Map<number, { profile: ProfileDto; commentId: number }>;
        latestDate: Date;
        postId: number;
      }
    >();

    for (const comment of recentComments) {
      const postId = comment.parentObjectId;

      if (!commentGroups.has(postId)) {
        commentGroups.set(postId, {
          users: new Map(),
          latestDate: comment.createdAt,
          postId,
        });
      }
      const group = commentGroups.get(postId)!;
      const author = loadedCommentAuthor(comment);
      if (!group.users.has(author.id)) {
        group.users.set(author.id, {
          profile: new ProfileDto(author),
          commentId: comment.id,
        });
      }
      if (comment.createdAt > group.latestDate) {
        group.latestDate = comment.createdAt;
      }
    }

    const postIds = Array.from(commentGroups.keys());
    if (postIds.length > 0) {
      const postsQuery = this.postRepository
        .createQueryBuilder("post")
        .select(["post.id", "post.title"])
        .where("post.id IN (:...postIds)", { postIds });
      this.forumService.addPostVisibilityFilter(postsQuery, "post");
      const posts = await postsQuery.getMany();

      const postTitleMap = new Map<number, string>();
      for (const post of posts) {
        postTitleMap.set(post.id, post.title);
      }

      for (const group of commentGroups.values()) {
        const postTitle = postTitleMap.get(group.postId);
        if (!postTitle) continue;

        const usersArray = Array.from(group.users.values());
        const forumComments: GlobalFeedForumCommentsDto = {
          users: usersArray
            .slice(0, GLOBAL_FEED_FACEPILE_LIMIT)
            .map((u) => u.profile),
          postId: group.postId,
          postTitle,
          count: group.users.size,
          commentId:
            usersArray.length === 1 ? usersArray[0].commentId : undefined,
        };

        feedItems.push(
          new GlobalFeedItemDto({
            type: GlobalFeedItemType.ForumComments,
            date: group.latestDate,
            forumComments,
          }),
        );
      }
    }

    feedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return feedItems.slice(0, limit);
  }

  async getTimelineFeed(
    limit: number = 15,
    userId?: number,
  ): Promise<TimelineFeedItemDto[]> {
    const feedItems: TimelineFeedItemDto[] = [];

    const now = new Date();

    const eventsQuery = this.actionEventRepository.find({
      relations: { action: { reviewers: true } },
      where: { newStatus: Not(ActionStatus.MemberAction) },
      order: { date: "DESC" },
      take: 10,
    });

    const actionUpdatesQuery = this.actionUpdateRepository.find({
      relations: { action: { reviewers: true }, schemaSnapshot: true },
      where: publishedActionUpdateWhere(now),
      order: { date: "DESC" },
      take: 10,
    });

    const [events, actionUpdates] = await Promise.all([
      eventsQuery,
      actionUpdatesQuery,
    ]);

    const visibleActionIds =
      await this.actionVisibility.visibleActionIdsForUser({
        actionIds: [
          ...events.map((event) => loadedActionEventAction(event).id),
          ...actionUpdates.map((update) => update.actionId),
        ],
        userId,
      });

    for (const event of events) {
      const action = loadedActionEventAction(event);
      if (!visibleActionIds.has(action.id)) {
        continue;
      }
      feedItems.push(
        new TimelineFeedItemDto({
          type: TimelineFeedItemType.ActionEvent,
          date: event.date,
          action: parseAction(action),
          actionEvent: event,
        }),
      );
    }

    for (const actionUpdate of actionUpdates) {
      if (!visibleActionIds.has(actionUpdate.actionId)) {
        continue;
      }
      if (!actionUpdate.action) {
        throw new Error(
          `action of action update ${actionUpdate.id} not loaded`,
        );
      }
      feedItems.push(
        new TimelineFeedItemDto({
          type: TimelineFeedItemType.ActionUpdate,
          date: actionUpdate.date,
          action: parseAction(actionUpdate.action),
          actionUpdate,
        }),
      );
    }

    feedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return feedItems.slice(0, limit);
  }
}
