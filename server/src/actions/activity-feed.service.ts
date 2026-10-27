import { ACTION_ACTIVITY_FEED_VISIBLE_TYPES } from "@alliance/common/actionActivity";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommunityService } from "src/community/community.service";
import { ForumCommentQueryService } from "src/forum/forum-comment-query.service";
import { FacepileService } from "src/likes/facepile.service";
import { type ParsedFormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { FriendService } from "../user/friend.service";
import { UserService } from "../user/user.service";
import { ActionVisibilityService } from "./action-visibility.service";
import { ActionsService } from "./actions.service";
import { ActivityOutputService } from "./activity-output.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { ActionActivityDto } from "./dto/action-activity.dto";
import {
  ActionActivity,
  loadedActionActivityLikes,
} from "./entities/action-activity.entity";

@Injectable()
export class ActivityFeedService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly actionsService: ActionsService,
    private readonly userService: UserService,
    private readonly friendService: FriendService,
    private readonly communityService: CommunityService,
    private readonly forumCommentQueryService: ForumCommentQueryService,
    private readonly facepileService: FacepileService,
    private readonly actionVisibility: ActionVisibilityService,
    private readonly activityOutput: ActivityOutputService,
  ) {}

  private async getLikedActivityIds(
    activityIds: number[],
    userId: number,
  ): Promise<Set<number>> {
    if (!activityIds.length || !userId) {
      return new Set();
    }

    const rows = await this.actionActivityRepository
      .createQueryBuilder("activity")
      .innerJoin("activity.likes", "liker", "liker.id = :userId", { userId })
      .where("activity.id IN (:...activityIds)", { activityIds })
      .select("activity.id", "id")
      .getRawMany<{ id: number }>();

    return new Set(rows.map((r) => r.id));
  }

  async findCompletedForUser(
    userId: number,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: {
        userId,
        type: In(ACTION_ACTIVITY_FEED_VISIBLE_TYPES),
      },
      relations: {
        action: true,
        user: true,
        editableContent: true,
        taskFormResponse: { formSnapshot: true },
      },
    });

    const visibleIds = await this.actionVisibility.visibleActionIdsForUser({
      actionIds: activities.map((activity) => activity.actionId),
      userId: requestingUserId,
    });
    return this.toActivityDtos({
      activities: activities.filter((activity) =>
        visibleIds.has(activity.actionId),
      ),
      requestingUserId,
      comments,
    });
  }

  async getActionActivities(
    actionId: number,
    limit?: number,
    comments?: boolean,
    requestingUserId?: number,
    before?: Date,
  ): Promise<ActionActivityDto[]> {
    await this.actionsService.findOneOrFail({
      id: actionId,
      userId: requestingUserId,
    });
    const activities = await this.fetchActivityFeed({
      limit: limit ?? 20,
      actionId,
      before,
    });

    return this.toActivityDtos({ activities, requestingUserId, comments });
  }

  /**
   * Adds public form response output on top of {@link toActivityDtos}, and
   * comments when `comments` is set. Used by the feeds that render activity
   * cards in full.
   */
  async toDetailedActivityDtos(params: {
    activities: ActionActivity[];
    requestingUserId?: number;
    comments: boolean;
    outputs?: Map<number, ParsedFormResponse>;
  }): Promise<ActionActivityDto[]> {
    const {
      activities,
      requestingUserId,
      comments: includeComments,
      outputs,
    } = params;
    const activityIds = activities.map((activity) => activity.id);
    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(activityIds, requestingUserId)
      : new Set<number>();
    const facepiles = await this.facepileService.loadFacepiles(
      ActionActivity,
      activityIds,
    );

    const commentsByActivity = includeComments
      ? await this.forumCommentQueryService.findCommentsForActivities(
          activityIds,
        )
      : null;

    return activities.map((activity) => {
      const comments = commentsByActivity?.get(activity.id) ?? [];
      return new ActionActivityDto(activity, {
        comments,
        formResponseOutput:
          outputs?.get(activity.id) ??
          this.activityOutput.buildOutputFormResponse(activity),
        likedByMe: likedIds.has(activity.id),
        requestingUserId,
        facepile: facepiles(activity.id),
      });
    });
  }

  /** Feed activities with their bounded liker facepiles and liked-by-me state. */
  private async toActivityDtos(params: {
    activities: ActionActivity[];
    requestingUserId?: number;
    comments?: boolean;
  }): Promise<ActionActivityDto[]> {
    const { activities, requestingUserId, comments } = params;
    if (activities.length === 0) {
      return [];
    }
    if (comments) {
      return this.toDetailedActivityDtos({
        activities,
        requestingUserId,
        comments: true,
      });
    }

    const activityIds = activities.map((activity) => activity.id);
    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(activityIds, requestingUserId)
      : new Set<number>();
    const facepiles = await this.facepileService.loadFacepiles(
      ActionActivity,
      activityIds,
    );

    return activities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
          facepile: facepiles(activity.id),
        }),
    );
  }

  /**
   * Shared helper to run optimized activity feed queries.
   * Only selects the fields needed for ActionActivityDto to minimize data transfer.
   * Returns activities on every action, visible to the viewer or not, so callers
   * filter by action visibility themselves.
   */
  fetchActivityFeed(options: {
    limit: number;
    before?: Date;
    userIds?: number[];
    actionId?: number;
    communityId?: number;
    requireFormResponse?: boolean;
  }) {
    const qb = this.actionActivityRepository
      .createQueryBuilder("activity")
      .leftJoinAndSelect("activity.user", "user")
      .leftJoinAndSelect("activity.action", "action")
      .leftJoinAndSelect("activity.editableContent", "editableContent")
      .leftJoinAndSelect("activity.taskFormResponse", "taskFormResponse")
      .leftJoinAndSelect("taskFormResponse.formSnapshot", "taskFormSnapshot")
      .select([
        "activity.id",
        "activity.type",
        "activity.actionId",
        "activity.userId",
        "activity.createdAt",
        "activity.likesCount",
        "user.id",
        "user.name",
        "user.profilePicture",
        "user.profileDescription",
        "user.admin",
        "user.staff",
        "user.anonymous",
        "action.id",
        "action.name",
        "editableContent.id",
        "editableContent.body",
        "editableContent.attachments",
        "taskFormResponse.id",
        "taskFormResponse.formId",
        "taskFormResponse.answers",
        "taskFormResponse.publicAnswers",
        "taskFormResponse.formSnapshotId",
        "taskFormResponse.visibilityValidatorResults",
        "taskFormResponse.formulaChoices",
        "taskFormResponse.deviceType",
        "taskFormSnapshot.id",
        "taskFormSnapshot.schema",
      ])
      .loadRelationIdAndMap("user.leaderOfIds", "user.leaderOf")
      .where("activity.type IN (:...types)", {
        types: ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
      })
      .orderBy("activity.createdAt", "DESC")
      .take(options.limit);

    if (options.before) {
      qb.andWhere("activity.createdAt < :before", { before: options.before });
    }

    if (options.communityId) {
      qb.innerJoin(
        "user.communities",
        "communityFilter",
        "communityFilter.id = :communityId",
        { communityId: options.communityId },
      );
    } else if (options.userIds?.length) {
      qb.andWhere("activity.userId IN (:...userIds)", {
        userIds: options.userIds,
      });
    }

    if (options.actionId) {
      qb.andWhere("activity.actionId = :actionId", {
        actionId: options.actionId,
      });
    }

    if (options.requireFormResponse) {
      qb.andWhere("taskFormResponse.id IS NOT NULL");
    }

    return qb.getMany();
  }

  private async fetchVisibleActivityFeed(options: {
    limit: number;
    before?: Date;
    userIds?: number[];
    actionId?: number;
    communityId?: number;
    requireFormResponse?: boolean;
    requestingUserId?: number;
    user?: User | null;
    session?: CohortResolutionSession;
  }): Promise<ActionActivity[]> {
    const session = options.session ?? new CohortResolutionSession();
    const user =
      options.user !== undefined
        ? options.user
        : await this.actionVisibility.loadUserForActionVisibility(
            options.requestingUserId,
          );

    const collected: ActionActivity[] = [];
    let cursor = options.before;
    const batchSize = Math.max(options.limit * 3, 20);

    while (collected.length < options.limit) {
      const batch = await this.fetchActivityFeed({
        limit: batchSize,
        before: cursor,
        userIds: options.userIds,
        actionId: options.actionId,
        communityId: options.communityId,
        requireFormResponse: options.requireFormResponse,
      });
      if (batch.length === 0) {
        break;
      }

      const visibleIds = await this.actionVisibility.visibleActionIdsForUser({
        actionIds: batch.map((activity) => activity.actionId),
        user,
        session,
      });
      for (const activity of batch) {
        if (visibleIds.has(activity.actionId)) {
          collected.push(activity);
          if (collected.length >= options.limit) {
            break;
          }
        }
      }

      if (batch.length < batchSize) {
        break;
      }
      cursor = batch[batch.length - 1].createdAt;
    }

    return collected;
  }

  async getActivityFeed(
    limit: number = 20,
    before?: Date,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.fetchVisibleActivityFeed({
      limit,
      before,
      requestingUserId,
    });

    return this.toActivityDtos({ activities, requestingUserId, comments });
  }

  async friendActivity(
    userId: number,
    comments?: boolean,
    limit?: number,
    before?: Date,
  ): Promise<ActionActivityDto[]> {
    const user = await this.userService.findOne(userId, {
      sentFriendRequests: true,
      receivedFriendRequests: true,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const friends = await this.friendService.findFriends(userId);

    if (friends.length === 0) {
      return [];
    }

    const friendActivities = await this.fetchVisibleActivityFeed({
      limit: limit ?? 20,
      before,
      userIds: friends.map((f) => f.id),
      requestingUserId: userId,
    });

    return this.toActivityDtos({
      activities: friendActivities,
      requestingUserId: userId,
      comments,
    });
  }

  async friendActivityForAction(
    userId: number,
    actionId: number,
    comments?: boolean,
    limit?: number,
  ): Promise<ActionActivityDto[]> {
    await this.actionsService.findOneOrFail({ id: actionId, userId });
    const friends = await this.friendService.findFriends(userId);

    if (friends.length === 0) {
      return [];
    }

    const friendActivities = await this.fetchActivityFeed({
      limit: limit ?? 20,
      userIds: friends.map((f) => f.id),
      actionId,
    });

    return this.toActivityDtos({
      activities: friendActivities,
      requestingUserId: userId,
      comments,
    });
  }

  async communityActivity(
    limitNum: number = 20,
    beforeDate: Date | undefined,
    communityId: number,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const community = await this.communityService.findOneOrFail(communityId);

    const members = community.users ?? [];

    if (members.length === 0) {
      return [];
    }

    const memberActivities = await this.fetchVisibleActivityFeed({
      limit: limitNum,
      before: beforeDate,
      userIds: members.map((m) => m.id),
      requestingUserId,
    });

    return this.toActivityDtos({
      activities: memberActivities,
      requestingUserId,
      comments,
    });
  }

  async getActivity(
    id: number,
    requestingUserId?: number,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: {
        user: true,
        action: true,
        likes: true,
        editableContent: true,
        taskFormResponse: { formSnapshot: true },
      },
    });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    await this.actionsService.findOneOrFail({
      id: activity.actionId,
      userId: requestingUserId,
    });
    return new ActionActivityDto(activity, {
      formResponseOutput: this.activityOutput.buildOutputFormResponse(activity),
      likedByMe: requestingUserId
        ? loadedActionActivityLikes(activity).some(
            (like) => like.id === requestingUserId,
          )
        : undefined,
    });
  }
}
