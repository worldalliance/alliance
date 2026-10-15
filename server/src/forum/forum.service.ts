/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { isPostAuthor } from "@alliance/common/postAuthors";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import { FacepileService } from "src/likes/facepile.service";
import type { Repository as TypedRepository } from "src/utils/Repository";
import {
  In,
  IsNull,
  Not,
  type FindOptionsRelations,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
  type SelectQueryBuilder,
} from "typeorm";
import { User } from "../user/entities/user.entity";
import { UserComment } from "./dto/comment.dto";
import { CreatePostDto, PostDtoArgs, UpdatePostDto } from "./dto/post.dto";
import { Comment, CommentParentObject } from "./entities/comment.entity";
import { EditableContent } from "./entities/editablecontent.entity";
import { parsePost, Post, type ParsedPost } from "./entities/post.entity";
import { flattenComments } from "./flatten-comments";
import { byForumListOrder } from "./forum-list-order";
import { lockLiveAction, lockLiveAuthor } from "./forum-locks";
import {
  countThreadComments,
  excludeCommentsUnderDeletedAuthors,
  hiddenCommentIds,
  withoutHiddenComments,
} from "./hidden-comments";
import { filterVisiblePosts } from "./post-visibility";

export type ForumFeedComment = {
  comment: Comment;
  postId: number;
  postTitle: string;
  likedByMe: boolean;
  likesCount: number;
  facepile: User[];
};

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EditableContent)
    private editableContentRepository: TypedRepository<EditableContent>,
    private readonly facepileService: FacepileService,
  ) {}

  async createPost(
    createPostDto: CreatePostDto,
    userId: number,
  ): Promise<ParsedPost> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    let visibleAt = new Date();
    if (
      createPostDto.visibleAt &&
      new Date(createPostDto.visibleAt) > visibleAt
    ) {
      visibleAt = new Date(createPostDto.visibleAt);
    }
    return this.postRepository.manager.transaction(async (manager) => {
      await lockLiveAuthor(manager, userId);
      if (createPostDto.actionId != null) {
        await lockLiveAction(manager, createPostDto.actionId);
      }
      const content = await manager.save(
        manager.create(EditableContent, {
          body: createPostDto.editableContent.body,
          attachments: createPostDto.editableContent.attachments ?? [],
        }),
      );
      const post = manager.create(Post, {
        title: createPostDto.title,
        actionId: createPostDto.actionId,
        author: user,
        authorId: user.id,
        editableContent: content,
        visibleAt,
        likes: [],
      });
      return parsePost(await manager.save(post));
    });
  }

  addPostVisibilityFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    postAlias: string,
    userId?: number,
  ): SelectQueryBuilder<T> {
    if (userId === undefined) {
      return filterVisiblePosts({ qb, postAlias });
    }
    qb.setParameter("postVisibility_userId", userId);
    return filterVisiblePosts({
      qb,
      postAlias,
      viewerIdSql: ":postVisibility_userId",
    });
  }

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

  async findAllPosts(userId?: number): Promise<PostDtoArgs[]> {
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .orderBy("post.updatedAt", "DESC");
    this.addPostVisibilityFilter(qb, "post", userId);

    const posts = await qb.getMany();

    if (!posts.length) {
      return [];
    }

    const postIds = posts.map((p) => p.id);
    const hiddenIds = await hiddenCommentIds(
      this.commentRepository.manager,
      postIds,
    );
    const commentCounts = await countThreadComments(
      this.commentRepository.manager,
      {
        postIds,
        hiddenIds,
      },
    );

    const postsWithAuthors = await this.postRepository.find({
      where: { id: In(postIds) },
      relations: { authors: true, likes: true, action: { reviewers: true } },
      relationLoadStrategy: "query",
    });
    const relationsByPostId = new Map(postsWithAuthors.map((p) => [p.id, p]));
    for (const post of posts) {
      const loaded = relationsByPostId.get(post.id);
      post.authors = loaded?.authors ?? [];
      post.likes = loaded?.likes ?? [];
      post.likesIds = loaded?.likesIds ?? [];
      if (post.action) {
        post.action.reviewers = loaded?.action?.reviewers;
      }
    }

    // 3) Fetch last comment per post in one query using DISTINCT ON (Postgres)
    const lastComments = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("comment.editableContent", "editableContent")
      .where("comment.parentObjectType = :parentType", {
        parentType: CommentParentObject.Post,
      })
      .andWhere("NOT (comment.id = ANY(:hiddenIds))", { hiddenIds })
      .andWhere("comment.parentObjectId IN (:...postIds)", { postIds })
      .distinctOn(["comment.parentObjectId"])
      .orderBy("comment.parentObjectId", "ASC")
      .addOrderBy("comment.createdAt", "DESC") // latest for each post
      .getMany();

    const lastCommentByPostId = new Map<number, Comment>(
      lastComments.map((c) => [c.parentObjectId, c]),
    );

    return posts
      .map((post) => ({
        post: parsePost(post),
        commentCount: commentCounts.get(post.id) ?? 0,
        lastComment: lastCommentByPostId.get(post.id) ?? undefined,
      }))
      .sort(byForumListOrder);
  }

  async findPostsByAction(params: {
    actionId: number;
    requestingUserId?: number;
  }): Promise<ParsedPost[]> {
    const { actionId, requestingUserId } = params;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoinAndSelect("post.likes", "likes")
      .where("post.actionId = :actionId", { actionId })
      .orderBy("post.updatedAt", "DESC");
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    return (await qb.getMany()).map(parsePost);
  }

  private visiblePostQuery(id: number, userId?: number) {
    return this.addPostVisibilityFilter(
      this.postRepository
        .createQueryBuilder("post")
        .where("post.id = :id", { id }),
      "post",
      userId,
    );
  }

  private async findOneVisiblePost(
    id: number,
    userId?: number,
  ): Promise<ParsedPost> {
    const post = await this.visiblePostQuery(id, userId)
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoinAndSelect("post.likes", "likes")
      .leftJoinAndSelect("post.tags", "tags")
      .getOne();
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    return parsePost(post);
  }

  async isPostVisible(id: number, userId?: number): Promise<boolean> {
    return this.visiblePostQuery(id, userId).getExists();
  }

  async assertPostVisible(id: number, userId?: number): Promise<void> {
    if (!(await this.isPostVisible(id, userId))) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
  }

  async findOnePostFull(id: number, userId?: number): Promise<ParsedPost> {
    return this.findOneVisiblePost(id, userId);
  }

  async findOnePost(id: number, userId?: number): Promise<ParsedPost> {
    return this.findOneVisiblePost(id, userId);
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
    this.addPostVisibilityFilter(qb, "post", viewerId);
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

  async updatePost(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ): Promise<ParsedPost> {
    const post = await this.findOnePost(id, userId);

    if (!isPostAuthor(post, userId)) {
      throw new NotFoundException("You can only edit your own posts");
    }

    await this.postRepository.manager.transaction(async (manager) => {
      if (
        updatePostDto.actionId != null &&
        updatePostDto.actionId !== post.actionId
      ) {
        await lockLiveAction(manager, updatePostDto.actionId);
      }
      await manager.update(Post, id, {
        title: updatePostDto.title ?? post.title,
        ...(updatePostDto.actionId != null && {
          actionId: updatePostDto.actionId,
        }),
        visibleAt: updatePostDto.visibleAt ?? post.visibleAt,
      });
    });
    if (updatePostDto.editableContent && post.editableContent) {
      const ec = await this.editableContentRepository.findOneBy({
        id: post.editableContent.id,
      });
      if (ec) {
        ec.body = updatePostDto.editableContent.body ?? ec.body;
        ec.attachments =
          updatePostDto.editableContent.attachments ?? ec.attachments;
        await this.editableContentRepository.save(ec);
      }
    }
    return this.findOnePost(id, userId);
  }

  async removePost(id: number, userId: number): Promise<void> {
    const post = await this.findOnePost(id, userId);

    if (!isPostAuthor(post, userId)) {
      throw new NotFoundException("You can only delete your own posts");
    }

    await this.postRepository.update(
      { id, deletedAt: IsNull() },
      { deletedAt: () => "CURRENT_TIMESTAMP", legacyDeleted: true },
    );
  }

  async findPostsByUser(params: {
    authorId: number;
    requestingUserId?: number;
  }): Promise<ParsedPost[]> {
    const { authorId, requestingUserId } = params;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoin("post.authors", "coAuthor")
      .andWhere("(post.authorId = :authorId OR coAuthor.id = :authorId)", {
        authorId,
      });
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    return (await qb.getMany()).map(parsePost);
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

  async findPostsByTitle(params: {
    title: string;
    requestingUserId: number;
  }): Promise<Post[]> {
    const { title, requestingUserId } = params;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .where("post.title ILIKE :title", { title: `%${title}%` });
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    return qb.getMany();
  }
}
