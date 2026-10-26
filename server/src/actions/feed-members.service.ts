import { type FeedActionActivity } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { ForumService } from "src/forum/forum.service";
import { hiddenCommentIds } from "src/forum/hidden-comments";
import { ProfileDto } from "src/user/dto/user.dto";
import {
  ContractEventType,
  sqlUserHasActiveContractAt,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { sqlUserHasProfilePicture } from "src/user/profile-picture";
import { In, type Repository } from "typeorm";
import { ActionsService } from "./actions.service";

/** Facepile preview size; member-list endpoints paginate full lists. */
export const GLOBAL_FEED_FACEPILE_LIMIT = 8;

/** Feed/member-list rolling window. */
const GLOBAL_FEED_WINDOW_DAYS = 8;

type FeedMemberPageRow = {
  userId: number | string;
  latestAt: Date | string;
  latestId: number | string;
};

type FeedMemberRankedQuery = {
  rankedSql: string;
  params: unknown[];
};

type FeedMemberSummaryRow = FeedMemberPageRow & {
  totalCount: number | string;
  windowLatestAt: Date | string;
};

export function globalFeedWindowStart(): Date {
  return new Date(Date.now() - milliseconds({ days: GLOBAL_FEED_WINDOW_DAYS }));
}

@Injectable()
export class FeedMembersService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly actionsService: ActionsService,
    private readonly forumService: ForumService,
  ) {}

  private buildRecentNewMembersRankedQuery(
    oneWeekAgo: Date,
    now: Date,
  ): FeedMemberRankedQuery {
    return {
      rankedSql: `
        SELECT "userId", "latestAt", "latestId"
        FROM (
          SELECT DISTINCT ON (signed_event."userId")
            signed_event."userId" AS "userId",
            signed_event.date AS "latestAt",
            signed_event.id AS "latestId"
          FROM "contract_event" signed_event
          LEFT JOIN LATERAL (
            SELECT previous_event.type
            FROM "contract_event" previous_event
            WHERE previous_event."userId" = signed_event."userId"
              AND previous_event."deletedAt" IS NULL
              AND (
                previous_event.date < signed_event.date
                OR (
                  previous_event.date = signed_event.date
                  AND previous_event.id < signed_event.id
                )
              )
            ORDER BY previous_event.date DESC, previous_event.id DESC
            LIMIT 1
          ) previous_event ON true
          WHERE signed_event.type = $1
            AND signed_event."deletedAt" IS NULL
            AND signed_event.date > $2
            AND (
              previous_event.type IS NULL
              OR previous_event.type = $3
            )
            AND ${sqlUserHasActiveContractAt('signed_event."userId"', "$4")}
          ORDER BY signed_event."userId" ASC, signed_event.date DESC, signed_event.id DESC
        ) ranked`,
      params: [
        ContractEventType.SIGNED,
        oneWeekAgo,
        ContractEventType.SUSPENDED,
        now,
      ],
    };
  }

  /** Recent active-contract members whose SIGNED event starts/resumes a contract. */
  async computeRecentNewMembers(
    oneWeekAgo: Date,
    now: Date,
  ): Promise<{ users: ProfileDto[]; count: number; latestDate: Date | null }> {
    const { rankedSql, params } = this.buildRecentNewMembersRankedQuery(
      oneWeekAgo,
      now,
    );
    return this.queryFeedMemberSummary({
      rankedSql,
      params,
      limit: GLOBAL_FEED_FACEPILE_LIMIT,
    });
  }

  private async queryFeedMemberPageIds({
    rankedSql,
    params,
    limit,
    afterId,
  }: {
    rankedSql: string;
    params: unknown[];
    limit: number;
    afterId?: number;
  }): Promise<number[]> {
    const pageParams = [...params];

    if (afterId === undefined) {
      const limitParam = pageParams.length + 1;
      pageParams.push(limit);
      const rows = await this.userRepository.query<FeedMemberPageRow[]>(
        `WITH ranked_members AS (${rankedSql})
        SELECT "userId", "latestAt", "latestId" FROM ranked_members
        ORDER BY "latestAt" DESC, "latestId" DESC
        LIMIT $${limitParam}`,
        pageParams,
      );
      return rows.map((row) => Number(row.userId));
    }

    // Share one materialized ranking; unknown cursors produce no page.
    const afterParam = pageParams.length + 1;
    pageParams.push(afterId);
    const limitParam = pageParams.length + 1;
    pageParams.push(limit);
    const rows = await this.userRepository.query<FeedMemberPageRow[]>(
      `WITH ranked_members AS MATERIALIZED (${rankedSql}),
      cursor_row AS (
        SELECT "latestAt", "latestId" FROM ranked_members WHERE "userId" = $${afterParam}
      )
      SELECT rm."userId", rm."latestAt", rm."latestId"
      FROM ranked_members rm, cursor_row c
      WHERE rm."latestAt" < c."latestAt"
        OR (rm."latestAt" = c."latestAt" AND rm."latestId" < c."latestId")
      ORDER BY rm."latestAt" DESC, rm."latestId" DESC
      LIMIT $${limitParam}`,
      pageParams,
    );

    return rows.map((row) => Number(row.userId));
  }

  private async hydrateFeedMemberProfiles(
    orderedIds: number[],
  ): Promise<ProfileDto[]> {
    if (orderedIds.length === 0) return [];

    // Hydrate only needed relations: `leaderOf` powers `isCommunityLeader`;
    // load `contractEvents`/`cluster` for accurate
    // `hasActiveContract`/`lastContractEvent`/`cluster`.
    const users = await this.userRepository.find({
      where: { id: In(orderedIds) },
      relations: { leaderOf: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((user): user is User => user !== undefined)
      .map((user) => new ProfileDto(user));
  }

  /**
   * Orders the facepile preview by profile picture first, then recency, so
   * recent photo-less joins don't crowd out photos from earlier in the
   * window. `windowLatestAt` is a window-wide MAX because the first row is
   * photo-first, not the most recent.
   */
  private async queryFeedMemberSummary({
    rankedSql,
    params,
    limit,
  }: {
    rankedSql: string;
    params: unknown[];
    limit: number;
  }): Promise<{ users: ProfileDto[]; count: number; latestDate: Date | null }> {
    const limitParam = params.length + 1;
    const rows = await this.userRepository.query<FeedMemberSummaryRow[]>(
      `SELECT feed_members."userId", feed_members."latestAt", feed_members."latestId",
        COUNT(*) OVER() AS "totalCount",
        MAX(feed_members."latestAt") OVER() AS "windowLatestAt"
      FROM (${rankedSql}) feed_members
      INNER JOIN "user" ON "user".id = feed_members."userId" AND "user"."deletedAt" IS NULL
      ORDER BY ${sqlUserHasProfilePicture('"user"."profilePicture"')} DESC, feed_members."latestAt" DESC, feed_members."latestId" DESC
      LIMIT $${limitParam}`,
      [...params, limit],
    );

    const users = await this.hydrateFeedMemberProfiles(
      rows.map((row) => Number(row.userId)),
    );

    return {
      users,
      count: rows.length === 0 ? 0 : Number(rows[0].totalCount),
      latestDate: rows[0]?.windowLatestAt
        ? new Date(rows[0].windowLatestAt)
        : null,
    };
  }

  async getActivityGroupMembers(
    actionId: number,
    activityType: FeedActionActivity,
    limit: number,
    afterId?: number,
    requestingUserId?: number,
  ): Promise<ProfileDto[]> {
    await this.actionsService.findOneOrFail({
      id: actionId,
      userId: requestingUserId,
    });
    const oneWeekAgo = globalFeedWindowStart();
    const rankedSql = `
      SELECT "userId", "latestAt", "latestId"
      FROM (
        SELECT DISTINCT ON (activity."userId")
          activity."userId" AS "userId",
          activity."createdAt" AS "latestAt",
          activity.id AS "latestId"
        FROM "action_activity" activity
        INNER JOIN "action" action_entity ON action_entity.id = activity."actionId"
        WHERE activity."actionId" = $1
          AND activity.type = $2
          AND action_entity.onboarding = false
          AND activity."createdAt" > $3
          AND activity."deletedAt" IS NULL
          AND action_entity."deletedAt" IS NULL
        ORDER BY activity."userId" ASC, activity."createdAt" DESC, activity.id DESC
      ) ranked`;

    const pageIds = await this.queryFeedMemberPageIds({
      rankedSql,
      params: [actionId, activityType, oneWeekAgo],
      limit,
      afterId,
    });
    return this.hydrateFeedMemberProfiles(pageIds);
  }

  async getNewMembers(limit: number, afterId?: number): Promise<ProfileDto[]> {
    const oneWeekAgo = globalFeedWindowStart();
    const { rankedSql, params } = this.buildRecentNewMembersRankedQuery(
      oneWeekAgo,
      new Date(),
    );

    const pageIds = await this.queryFeedMemberPageIds({
      rankedSql,
      params,
      limit,
      afterId,
    });
    return this.hydrateFeedMemberProfiles(pageIds);
  }

  async getForumCommentMembers(
    postId: number,
    limit: number,
    afterId?: number,
    requestingUserId?: number,
  ): Promise<ProfileDto[]> {
    const oneWeekAgo = globalFeedWindowStart();
    await this.forumService.findOnePost(postId, requestingUserId);
    const rankedSql = `
      SELECT "userId", "latestAt", "latestId"
      FROM (
        SELECT DISTINCT ON (comment."authorId")
          comment."authorId" AS "userId",
          comment."createdAt" AS "latestAt",
          comment.id AS "latestId"
        FROM "comment" comment
        WHERE comment."parentObjectType" = $1
          AND comment."parentObjectId" = $2
          AND comment."createdAt" > $3
          AND comment."deletedAt" IS NULL
          AND NOT (comment.id = ANY($4))
        ORDER BY comment."authorId" ASC, comment."createdAt" DESC, comment.id DESC
      ) ranked`;

    const pageIds = await this.queryFeedMemberPageIds({
      rankedSql,
      params: [
        CommentParentObject.Post,
        postId,
        oneWeekAgo,
        await hiddenCommentIds(this.commentRepository.manager, [postId]),
      ],
      limit,
      afterId,
    });
    return this.hydrateFeedMemberProfiles(pageIds);
  }
}
