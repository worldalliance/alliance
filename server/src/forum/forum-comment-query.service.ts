import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import { FacepileService } from "src/likes/facepile.service";
import {
  In,
  Not,
  type FindOptionsRelations,
  type FindOptionsWhere,
  type Repository,
  type SelectQueryBuilder,
} from "typeorm";
import { User } from "../user/entities/user.entity";
import { UserComment } from "./dto/comment.dto";
import { Comment, CommentParentObject } from "./entities/comment.entity";
import { Post } from "./entities/post.entity";
import { flattenComments } from "./flatten-comments";
import { ForumService } from "./forum.service";
import {
  excludeCommentsUnderDeletedAuthors,
  withoutHiddenComments,
} from "./hidden-comments";

export type ForumFeedComment = {
  comment: Comment;
  postId: number;
  postTitle: string;
  likedByMe: boolean;
  likesCount: number;
  facepile: User[];
};

@Injectable()
export class ForumCommentQueryService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    private readonly facepileService: FacepileService,
    private readonly forumService: ForumService,
  ) {}

  private async getLikedCommentIds(
    commentIds: number[],
    userId: number | undefined,
  ): Promise<Set<number>> {
    if (!commentIds.length || !userId) {
      return new Set();
    }

    const rows = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin("comment.likes", "liker", "liker.id = :userId", { userId })
      .where("comment.id IN (:...commentIds)", { commentIds })
      .select("comment.id", "id")
      .getRawMany<{ id: number }>();

    return new Set(rows.map((r) => r.id));
  }

  /**
   * A thread's comment trees, deleted comments included for their replies to
   * hang under, without the comments whose author's account was deleted, nor
   * the replies under them.
   */
  private async findThreadComments(params: {
    where: FindOptionsWhere<Comment>;
    relations?: FindOptionsRelations<Comment>;
  }): Promise<Comment[]> {
    const comments = await findWithDeletedRoot(this.commentRepository.manager, {
      target: Comment,
      options: {
        where: params.where,
        relations: { author: true, ...params.relations },
        order: { createdAt: "ASC" },
      },
    }).getMany();
    // The author join leaves out a deleted account, and the hierarchy drops
    // the replies whose parent it no longer finds.
    return this.organizeRepliesHierarchy(
      comments.filter((comment) => comment.author),
    );
  }

  async findCommentsForPostRaw(postId: number): Promise<Comment[]> {
    const comments = await this.findThreadComments({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
    });
    return flattenComments(comments);
  }

  async findCommentsForPost(postId: number): Promise<Comment[]> {
    return this.findThreadComments({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
      relations: {
        author: { cluster: true },
        editableContent: true,
        likes: true,
      },
    });
  }

  async findLastCommentForPost(postId: number): Promise<Comment | null> {
    const lastComment = await this.commentRepository.findOne({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
      relations: { author: true, editableContent: true },
      order: { createdAt: "DESC" },
    });

    return lastComment;
  }

  async findCommentsForActivity(activityId: number): Promise<Comment[]> {
    return this.findThreadComments({
      where: {
        parentObjectId: activityId,
        parentObjectType: CommentParentObject.Activity,
      },
      relations: { editableContent: true, likes: true },
    });
  }

  async findCommentsForActivities(
    activityIds: number[],
  ): Promise<Map<number, Comment[]>> {
    if (activityIds.length === 0) {
      return new Map();
    }

    const roots = await this.findThreadComments({
      where: {
        parentObjectId: In(activityIds),
        parentObjectType: CommentParentObject.Activity,
      },
      relations: { editableContent: true, likes: true },
    });

    const grouped = new Map<number, Comment[]>();
    for (const comment of roots) {
      const commentsForActivity =
        grouped.get(comment.parentObjectId) ?? ([] as Comment[]);
      commentsForActivity.push(comment);
      grouped.set(comment.parentObjectId, commentsForActivity);
    }

    return grouped;
  }

  async findForumCommentsForFeed(params: {
    userId: number;
    userClusterId: number | null;
    sourceUserIds: number[];
    limit: number;
    before?: Date;
  }): Promise<ForumFeedComment[]> {
    const { userId, userClusterId, sourceUserIds, limit, before } = params;

    const qb = this.forumFeedCommentsQuery();

    const authorClauses: string[] = ["author.id = :feedUserId"];
    const authorParams: Record<string, unknown> = { feedUserId: userId };
    if (sourceUserIds.length > 0) {
      authorClauses.push("author.id IN (:...feedSourceUserIds)");
      authorParams.feedSourceUserIds = sourceUserIds;
    }
    if (userClusterId != null) {
      authorClauses.push(
        "(post.showClusterTags = true AND author.clusterId = :feedClusterId)",
      );
      authorParams.feedClusterId = userClusterId;
    }
    qb.andWhere(`(${authorClauses.join(" OR ")})`, authorParams);

    return this.loadForumFeedComments({ qb, viewerId: userId, limit, before });
  }

  async findForumCommentsByUserForFeed(params: {
    authorId: number;
    requestingUserId?: number;
    limit: number;
    before?: Date;
  }): Promise<ForumFeedComment[]> {
    const { authorId, requestingUserId, limit, before } = params;

    const qb = this.forumFeedCommentsQuery().andWhere("author.id = :authorId", {
      authorId,
    });

    return this.loadForumFeedComments({
      qb,
      viewerId: requestingUserId,
      limit,
      before,
    });
  }

  private forumFeedCommentsQuery(): SelectQueryBuilder<Comment> {
    const qb = this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin(Post, "post", "post.id = comment.parentObjectId")
      .innerJoinAndSelect("comment.author", "author")
      .innerJoinAndSelect("comment.editableContent", "editableContent")
      .addSelect(["post.id", "post.title"])
      .where("comment.parentObjectType = :postType", {
        postType: CommentParentObject.Post,
      });
    return excludeCommentsUnderDeletedAuthors(qb);
  }

  private async loadForumFeedComments(params: {
    qb: SelectQueryBuilder<Comment>;
    viewerId: number | undefined;
    limit: number;
    before?: Date;
  }): Promise<ForumFeedComment[]> {
    const { qb, viewerId, limit, before } = params;
    this.forumService.addPostVisibilityFilter(qb, "post", viewerId);
    if (before) {
      qb.andWhere("comment.createdAt < :before", { before });
    }
    qb.orderBy("comment.createdAt", "DESC").limit(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const commentIds = entities.map((c) => c.id);
    const facepiles = await this.facepileService.loadFacepiles(
      Comment,
      commentIds,
    );
    const likedCommentIds = await this.getLikedCommentIds(commentIds, viewerId);
    const titleByCommentId = new Map<number, string>();
    for (const row of raw) {
      titleByCommentId.set(row.comment_id, row.post_title);
    }
    const items: ForumFeedComment[] = [];
    for (const comment of entities) {
      const postTitle = titleByCommentId.get(comment.id);
      if (postTitle == null) continue;
      items.push({
        comment,
        postId: comment.parentObjectId,
        postTitle,
        likedByMe: likedCommentIds.has(comment.id),
        likesCount: comment.likesCount,
        facepile: facepiles(comment.id),
      });
    }
    return items;
  }

  async findCommentsForAction(actionId: number): Promise<Comment[]> {
    return this.findThreadComments({
      where: {
        parentObjectId: actionId,
        parentObjectType: CommentParentObject.Action,
      },
      relations: { editableContent: true, likes: true },
    });
  }

  private organizeRepliesHierarchy(replies: Comment[]): Comment[] {
    if (replies.length === 0) {
      return [];
    }
    const childrenById = new Map<number, Comment[]>(
      replies.map((reply) => [reply.id, []]),
    );
    const topLevelReplies: Comment[] = [];

    // Organize into hierarchy
    replies.forEach((reply) => {
      if (reply.parentId === null) {
        topLevelReplies.push(reply);
      } else {
        childrenById.get(reply.parentId)?.push(reply);
      }
    });

    // Sort all levels by creation date
    const sortReplies = (repliesList: Comment[]): Comment[] => {
      return repliesList
        .sort(
          (a, b) =>
            (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1) ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        )
        .map((reply) => ({
          ...reply,
          children: sortReplies(childrenById.get(reply.id) ?? []),
        }));
    };

    return sortReplies(topLevelReplies);
  }

  async findCommentsByUser(userId: number): Promise<UserComment[]> {
    const comments = await withoutHiddenComments(
      this.commentRepository.manager,
      await this.commentRepository.find({
        where: {
          authorId: userId,
          parentObjectType: Not(CommentParentObject.Activity),
        },
        relations: { author: true, editableContent: true },
      }),
    );
    const postIds = comments
      .filter(
        (comment) => comment.parentObjectType === CommentParentObject.Post,
      )
      .map((comment) => comment.parentObjectId);

    const actionIds = comments
      .filter(
        (comment) => comment.parentObjectType === CommentParentObject.Action,
      )
      .map((comment) => comment.parentObjectId);

    const posts = await this.postRepository.find({
      where: { id: In(postIds) },
    });

    const actions = await this.actionRepository.find({
      where: { id: In(actionIds) },
    });

    const parentTitleOf = (comment: Comment): string | undefined => {
      switch (comment.parentObjectType) {
        case CommentParentObject.Post:
          return posts.find((post) => post.id === comment.parentObjectId)
            ?.title;
        case CommentParentObject.Action:
          return actions.find((action) => action.id === comment.parentObjectId)
            ?.name;
        case CommentParentObject.Activity:
          throw new Error(
            `activity comment ${comment.id} reached a member's comment list`,
          );
        default:
          throw new Error(
            `unknown comment parent: ${comment.parentObjectType satisfies never}`,
          );
      }
    };

    return comments.flatMap((comment) => {
      const parentTitle = parentTitleOf(comment);
      return parentTitle === undefined ? [] : [{ comment, parentTitle }];
    });
  }

  async findForumCommentsByUser(userId: number): Promise<Comment[]> {
    return withoutHiddenComments(
      this.commentRepository.manager,
      await this.commentRepository.find({
        where: {
          authorId: userId,
          parentObjectType: CommentParentObject.Post,
        },
        relations: { author: true, editableContent: true, likes: true },
        order: { createdAt: "DESC" },
      }),
    );
  }
}
