import { LIKE_ORDER_RANK_FN, likeOrderRank } from "@alliance/common/likeOrder";
import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionsService } from "src/actions/actions.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { ForumService } from "src/forum/forum.service";
import { User } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import { FacepileService } from "./facepile.service";

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly forumService: ForumService,
    private readonly facepileService: FacepileService,
    @Inject(forwardRef(() => ActionsService))
    private readonly actionsService: ActionsService,
  ) {}

  async getPostLikers(
    postId: number,
    limit: number,
    afterId: number | undefined,
    requestingUserId: number | undefined,
  ): Promise<User[]> {
    // Reuse post-detail visibility so hidden posts don't leak likers.
    await this.forumService.findOnePost(postId, requestingUserId);
    return this.getLikers(Post, postId, limit, afterId);
  }

  async getCommentLikers(
    commentId: number,
    limit: number,
    afterId: number | undefined,
    requestingUserId: number | undefined,
  ): Promise<User[]> {
    await this.assertCommentVisible(commentId, requestingUserId);
    return this.getLikers(Comment, commentId, limit, afterId);
  }

  async getActivityLikers(
    activityId: number,
    limit: number,
    afterId: number | undefined,
    requestingUserId: number | undefined,
  ): Promise<User[]> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id: activityId },
      select: { id: true, actionId: true },
    });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    await this.actionsService.findOneOrFail({
      id: activity.actionId,
      userId: requestingUserId,
    });
    return this.getLikers(ActionActivity, activityId, limit, afterId);
  }

  private async assertCommentVisible(
    commentId: number,
    requestingUserId: number | undefined,
  ): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      select: {
        id: true,
        deleted: true,
        parentObjectType: true,
        parentObjectId: true,
      },
    });
    if (!comment || comment.deleted) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found`);
    }

    switch (comment.parentObjectType) {
      case CommentParentObject.Post:
        await this.forumService.findOnePost(
          comment.parentObjectId,
          requestingUserId,
        );
        break;
      case CommentParentObject.Action:
        await this.actionsService.findOneOrFail({
          id: comment.parentObjectId,
          userId: requestingUserId,
        });
        break;
      case CommentParentObject.Activity: {
        const activity = await this.actionActivityRepository.findOne({
          where: { id: comment.parentObjectId },
          select: { id: true, actionId: true },
        });
        if (!activity) {
          throw new NotFoundException(
            `Comment with ID "${commentId}" not found`,
          );
        }
        await this.actionsService.findOneOrFail({
          id: activity.actionId,
          userId: requestingUserId,
        });
        break;
      }
      default:
        comment.parentObjectType satisfies never;
    }
  }

  /**
   * Liker page ordered like inline facepiles. The cursor stays a user id; its
   * hash rank seeds `(rank, user.id)` keyset pagination in SQL.
   */
  private async getLikers(
    target: typeof Post | typeof Comment | typeof ActionActivity,
    targetId: number,
    limit: number,
    afterId?: number,
  ): Promise<User[]> {
    // targetId is ParseIntPipe-validated; inline it to avoid reusing the join
    // param in ORDER BY.
    const rankExpr = `${LIKE_ORDER_RANK_FN}('${targetId}:' || "user"."id"::text)`;
    const query = this.userRepository
      .createQueryBuilder("user")
      .select("user.id", "id")
      .innerJoin(target, "target", "target.id = :targetId", { targetId })
      .innerJoin("target.likes", "liker", "liker.id = user.id")
      .orderBy(rankExpr, "ASC")
      .addOrderBy("user.id", "ASC")
      .limit(limit);

    if (afterId !== undefined) {
      // Cursor rank plus id matches `byLikeOrder`'s collision tiebreaker.
      query.andWhere(
        `(${rankExpr} > :afterRank OR (${rankExpr} = :afterRank AND "user"."id" > :afterId))`,
        { afterRank: likeOrderRank(targetId, afterId), afterId },
      );
    }

    const pageIds = (await query.getRawMany<{ id: number }>()).map((row) =>
      Number(row.id),
    );
    return this.facepileService.hydrateLikers(pageIds);
  }
}
