import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { Action } from "src/actions/entities/action.entity";
import { AiDetectionQueueService } from "src/ai-detection/ai-detection-queue.service";
import { DetectableEntity } from "src/ai-detection/entities/ai-detection-result.entity";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { FacepileService } from "src/likes/facepile.service";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { UnreadContentType } from "src/notifs/entities/unread-content.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { generateCIDForNotif } from "src/notifs/notif-utils";
import { NotifsService } from "src/notifs/notifs.service";
import { commentUrl, postUrl, withCid } from "src/search/approutes";
import { ProfileDto } from "src/user/dto/user.dto";
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository as TypedRepository } from "src/utils/Repository";
import {
  type EntityManager,
  ILike,
  In,
  Not,
  type ObjectLiteral,
  type Repository,
  type SelectQueryBuilder,
} from "typeorm";
import { Notification } from "../notifs/entities/notification.entity";
import { User } from "../user/entities/user.entity";
import {
  CreateCommentDto,
  UpdateCommentDto,
  UserComment,
} from "./dto/comment.dto";
import { UpdatePostTagsDto } from "./dto/post-tag.dto";
import { CreatePostDto, PostDtoArgs, UpdatePostDto } from "./dto/post.dto";
import { Comment, CommentParentObject } from "./entities/comment.entity";
import { EditableContent } from "./entities/editablecontent.entity";
import { PostTag } from "./entities/post-tag.entity";
import { parsePost, Post, type ParsedPost } from "./entities/post.entity";

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
    @InjectRepository(Notification)
    private notifRepository: Repository<Notification>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ActionActivity)
    private actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(EditableContent)
    private editableContentRepository: TypedRepository<EditableContent>,
    @InjectRepository(PostTag)
    private postTagRepository: Repository<PostTag>,
    private readonly likeNotificationService: LikeNotificationService,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly aiDetectionQueueService: AiDetectionQueueService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly facepileService: FacepileService,
  ) {}

  async createPost(
    createPostDto: CreatePostDto,
    userId: number,
  ): Promise<ParsedPost> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    const content = this.editableContentRepository.create({
      body: createPostDto.editableContent.body,
      attachments: createPostDto.editableContent.attachments ?? [],
    });
    await this.editableContentRepository.save(content);
    let visibleAt = new Date();
    if (
      createPostDto.visibleAt &&
      new Date(createPostDto.visibleAt) > visibleAt
    ) {
      visibleAt = new Date(createPostDto.visibleAt);
    }
    const post = this.postRepository.create({
      title: createPostDto.title,
      actionId: createPostDto.actionId,
      author: user,
      authorId: user.id,
      editableContent: content,
      visibleAt,
      likes: [],
    });
    return parsePost(await this.postRepository.save(post));
  }

  private addPostVisibilityFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    postAlias: string,
    userId?: number,
  ): SelectQueryBuilder<T> {
    qb.andWhere(`${postAlias}.deleted = false`);
    const clauses = [
      `${postAlias}.visibleAt IS NULL`,
      `${postAlias}.visibleAt < :postVisibility_now`,
    ];
    const params: Record<string, unknown> = {
      postVisibility_now: new Date(),
    };
    if (userId !== undefined) {
      const coAuthorSubQuery = qb
        .subQuery()
        .select("1")
        .from(Post, "visPost")
        .innerJoin("visPost.authors", "visAuthor")
        .where(`visPost.id = ${postAlias}.id`)
        .andWhere("visAuthor.id = :postVisibility_userId")
        .getQuery();
      clauses.push(`${postAlias}.authorId = :postVisibility_userId`);
      clauses.push(`EXISTS ${coAuthorSubQuery}`);
      params.postVisibility_userId = userId;
    }
    qb.andWhere(`(${clauses.join(" OR ")})`, params);
    return qb;
  }

  private async getLikedCommentIds(
    commentIds: number[],
    userId: number,
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
      .leftJoin(
        Comment,
        "comment",
        "comment.parentObjectId = post.id " +
          "AND comment.parentObjectType = :parentType " +
          "AND comment.deleted = false",
        { parentType: CommentParentObject.Post },
      )
      .orderBy("post.updatedAt", "DESC")
      .addSelect("COUNT(comment.id)", "commentCount")
      .groupBy("post.id")
      .addGroupBy("author.id")
      .addGroupBy("action.id")
      .addGroupBy("editableContent.id");
    this.addPostVisibilityFilter(qb, "post", userId);

    const { entities: posts, raw } = await qb.getRawAndEntities();

    if (!posts.length) {
      return [];
    }

    const postIds = posts.map((p) => p.id);

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
      .leftJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("comment.editableContent", "editableContent")
      .where("comment.parentObjectType = :parentType", {
        parentType: CommentParentObject.Post,
      })
      .andWhere("comment.deleted = false")
      .andWhere("comment.parentObjectId IN (:...postIds)", { postIds })
      .distinctOn(["comment.parentObjectId"])
      .orderBy("comment.parentObjectId", "ASC")
      .addOrderBy("comment.createdAt", "DESC") // latest for each post
      .getMany();

    const lastCommentByPostId = new Map<number, Comment>(
      lastComments.map((c) => [c.parentObjectId, c]),
    );

    return posts.map((post, index) => ({
      post: parsePost(post),
      commentCount: Number(raw[index].commentCount ?? 0),
      lastComment: lastCommentByPostId.get(post.id) ?? undefined,
    }));
  }

  async findPostsByAction(actionId: number): Promise<ParsedPost[]> {
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
    this.addPostVisibilityFilter(qb, "post");
    const posts = (await qb.getMany()).map(parsePost);

    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        const comments = await this.commentRepository.find({
          where: {
            parentObjectId: post.id,
            parentObjectType: CommentParentObject.Post,
          },
        });
        return {
          ...post,
          replies: [],
          replyCount: comments.length,
        };
      }),
    );
    return postsWithComments;
  }

  private async findOneVisiblePost(
    id: number,
    userId?: number,
  ): Promise<ParsedPost> {
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoinAndSelect("post.likes", "likes")
      .leftJoinAndSelect("post.tags", "tags")
      .where("post.id = :id", { id });
    this.addPostVisibilityFilter(qb, "post", userId);
    const post = await qb.getOne();
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    return parsePost(post);
  }

  async findOnePostFull(id: number, userId?: number): Promise<ParsedPost> {
    return this.findOneVisiblePost(id, userId);
  }

  async findOnePost(id: number, userId?: number): Promise<ParsedPost> {
    return this.findOneVisiblePost(id, userId);
  }

  async findCommentsForPostRaw(postId: number): Promise<Comment[]> {
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
      relations: { author: true },
      order: { createdAt: "ASC" },
    });

    return allComments;
  }

  async findCommentsForPost(postId: number): Promise<Comment[]> {
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
      relations: {
        author: { cluster: true },
        editableContent: true,
        likes: true,
      },
      order: { createdAt: "ASC" },
    });

    return this.organizeRepliesHierarchy(allComments);
  }

  async findLastCommentForPost(postId: number): Promise<Comment | null> {
    const lastComment = await this.commentRepository.findOne({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
        deleted: false,
      },
      relations: { author: true, editableContent: true },
      order: { createdAt: "DESC" },
    });

    return lastComment;
  }

  async findCommentsForActivity(activityId: number): Promise<Comment[]> {
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: activityId,
        parentObjectType: CommentParentObject.Activity,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: "ASC" },
    });

    return this.organizeRepliesHierarchy(allComments);
  }

  async findCommentsForActivities(
    activityIds: number[],
  ): Promise<Map<number, Comment[]>> {
    if (activityIds.length === 0) {
      return new Map();
    }

    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: In(activityIds),
        parentObjectType: CommentParentObject.Activity,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: "ASC" },
    });

    const grouped = new Map<number, Comment[]>();
    for (const comment of allComments) {
      const commentsForActivity =
        grouped.get(comment.parentObjectId) ?? ([] as Comment[]);
      commentsForActivity.push(comment);
      grouped.set(comment.parentObjectId, commentsForActivity);
    }

    grouped.forEach((comments, activityId) => {
      grouped.set(activityId, this.organizeRepliesHierarchy(comments));
    });

    return grouped;
  }

  async findForumCommentsForFeed(params: {
    userId: number;
    userClusterId: number | null;
    friendAndGroupMemberIds: number[];
    limit: number;
    before?: Date;
  }): Promise<ForumFeedComment[]> {
    const { userId, userClusterId, friendAndGroupMemberIds, limit, before } =
      params;

    const qb = this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin(Post, "post", "post.id = comment.parentObjectId")
      .innerJoinAndSelect("comment.author", "author")
      .innerJoinAndSelect("comment.editableContent", "editableContent")
      .addSelect(["post.id", "post.title"])
      .where("comment.parentObjectType = :postType", {
        postType: CommentParentObject.Post,
      })
      .andWhere("comment.deleted = false");

    const authorClauses: string[] = ["author.id = :feedUserId"];
    const authorParams: Record<string, unknown> = { feedUserId: userId };
    if (friendAndGroupMemberIds.length > 0) {
      authorClauses.push("author.id IN (:...feedFriendIds)");
      authorParams.feedFriendIds = friendAndGroupMemberIds;
    }
    if (userClusterId != null) {
      authorClauses.push(
        "(post.showClusterTags = true AND author.clusterId = :feedClusterId)",
      );
      authorParams.feedClusterId = userClusterId;
    }
    qb.andWhere(`(${authorClauses.join(" OR ")})`, authorParams);
    this.addPostVisibilityFilter(qb, "post", userId);
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
    const likedCommentIds = await this.getLikedCommentIds(commentIds, userId);
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

  async findForumCommentsByUserForFeed(params: {
    authorId: number;
    requestingUserId?: number;
    limit: number;
    before?: Date;
  }): Promise<ForumFeedComment[]> {
    const { authorId, requestingUserId, limit, before } = params;

    const qb = this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin(Post, "post", "post.id = comment.parentObjectId")
      .innerJoinAndSelect("comment.author", "author")
      .innerJoinAndSelect("comment.editableContent", "editableContent")
      .addSelect(["post.id", "post.title"])
      .where("comment.parentObjectType = :postType", {
        postType: CommentParentObject.Post,
      })
      .andWhere("comment.deleted = false")
      .andWhere("author.id = :authorId", { authorId });
    if (before) {
      qb.andWhere("comment.createdAt < :before", { before });
    }
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    qb.orderBy("comment.createdAt", "DESC").limit(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const commentIds = entities.map((c) => c.id);
    const facepiles = await this.facepileService.loadFacepiles(
      Comment,
      commentIds,
    );
    const likedCommentIds = requestingUserId
      ? await this.getLikedCommentIds(commentIds, requestingUserId)
      : new Set<number>();
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
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: actionId,
        parentObjectType: CommentParentObject.Action,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: "ASC" },
    });

    return this.organizeRepliesHierarchy(allComments);
  }

  private organizeRepliesHierarchy(replies: Comment[]): Comment[] {
    if (replies.length === 0) {
      return [];
    }
    // Create a map for quick lookup
    const replyMap = new Map<number, Comment>();
    const topLevelReplies: Comment[] = [];

    // Initialize all replies with empty children arrays
    replies.forEach((reply) => {
      reply.children = [];
      replyMap.set(reply.id, reply);
    });

    // Organize into hierarchy
    replies.forEach((reply) => {
      if (reply.parentId === null || reply.parentId === undefined) {
        topLevelReplies.push(reply);
      } else {
        const parent = replyMap.get(reply.parentId);
        if (parent) {
          parent.children.push(reply);
        }
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
          children: sortReplies(reply.children || []),
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

    if (
      post.authorId !== userId &&
      !post.authors?.some((author) => author.id === userId)
    ) {
      throw new NotFoundException("You can only edit your own posts");
    }

    await this.postRepository.update(id, {
      title: updatePostDto.title ?? post.title,
      actionId: updatePostDto.actionId ?? post.actionId,
      visibleAt: updatePostDto.visibleAt ?? post.visibleAt,
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

    if (
      post.authorId !== userId &&
      !post.authors?.some((author) => author.id === userId)
    ) {
      throw new NotFoundException("You can only delete your own posts");
    }

    await this.postRepository.update(id, { deleted: true });
  }

  private async resolveCommentTag(
    createCommentDto: CreateCommentDto,
  ): Promise<number | null> {
    if (
      createCommentDto.parentObjectType !== CommentParentObject.Post ||
      createCommentDto.parentId
    ) {
      return null;
    }

    const tags = await this.postTagRepository.find({
      where: { postId: createCommentDto.parentObjectId },
    });

    if (tags.length === 0) {
      return null;
    }
    const tagId = createCommentDto.tagId;
    if (tagId == null) {
      throw new BadRequestException("Pick a tag for this comment");
    }
    if (!tags.some((tag) => tag.id === tagId)) {
      throw new BadRequestException(
        `Tag ${tagId} does not belong to post ${createCommentDto.parentObjectId}`,
      );
    }
    return tagId;
  }

  async createComment(
    createCommentDto: CreateCommentDto,
    userId: number,
  ): Promise<Comment> {
    // Validate parent reply if provided
    let parentReply: Comment | null = null;
    if (createCommentDto.parentId) {
      parentReply = await this.commentRepository.findOne({
        where: {
          id: createCommentDto.parentId,
          parentObjectId: createCommentDto.parentObjectId,
        },
        relations: { author: true },
      });

      if (!parentReply) {
        throw new NotFoundException(
          `Parent reply with ID "${createCommentDto.parentId}" not found`,
        );
      }
    }

    if (
      !createCommentDto.editableContent.body &&
      (!createCommentDto.editableContent.attachments ||
        createCommentDto.editableContent.attachments.length === 0)
    ) {
      throw new BadRequestException("Reply cannot be empty");
    }

    const tagId = await this.resolveCommentTag(createCommentDto);

    const content = this.editableContentRepository.create({
      body: createCommentDto.editableContent.body,
      attachments: createCommentDto.editableContent.attachments ?? [],
    });
    await this.editableContentRepository.save(content);

    const reply = this.commentRepository.create({
      ...createCommentDto,
      tagId,
      authorId: userId,
      editableContent: content,
    });

    await this.postRepository.update(createCommentDto.parentObjectId, {
      updatedAt: new Date(),
    });

    await this.commentRepository.save(reply);

    // TODO: notify action authors in app?
    if (
      createCommentDto.parentObjectType === CommentParentObject.Action &&
      process.env.NODE_ENV === "production"
    ) {
      this.eventLogService.sendMessage({
        type: EventType.ActionComment,
        message: `New comment on action ${createCommentDto.parentObjectId}`,
        slackMessage: `New comment on action ${createCommentDto.parentObjectId} <@U08P0TJ283T> <@U08NU231VGS> - <${process.env.APP_URL}/actions/${createCommentDto.parentObjectId}?replyId=${reply.id}|Open action>`,
        userId: userId,
        blob: {
          actionId: createCommentDto.parentObjectId,
          commentId: reply.id,
        },
      });
    }

    const replyWithAuthor = await this.commentRepository.findOneOrFail({
      where: { id: reply.id },
      relations: { author: true, editableContent: true },
    });
    await this.aiDetectionQueueService.addDetectJob({
      entityType: DetectableEntity.Comment,
      entityId: replyWithAuthor.id,
    });

    await this.sendNotifsForNewComment(replyWithAuthor);

    return replyWithAuthor;
  }

  async sendNotifsForNewComment(comment: Comment): Promise<void> {
    const usersToNotify: User[] = [];

    let parentAuthor: User | undefined;
    if (comment.parentId) {
      const parentReply = await this.commentRepository.findOneOrFail({
        where: { id: comment.parentId, deleted: false },
        relations: { author: { contractEvents: true } },
      });
      parentAuthor = parentReply.author;
    }

    if (comment.parentObjectType === CommentParentObject.Post) {
      const post = await this.postRepository.findOneOrFail({
        where: { id: comment.parentObjectId, deleted: false },
        relations: { author: true, authors: true },
      });
      if (!post.author) {
        throw new Error(`Post ${post.id} was loaded without author`);
      }
      usersToNotify.push(post.author);
      if (post.authors?.length) {
        usersToNotify.push(...post.authors);
      }
    }
    if (comment.parentObjectType === CommentParentObject.Activity) {
      const activity = await this.actionActivityRepository.findOneOrFail({
        where: { id: comment.parentObjectId },
        relations: { user: true, action: { reviewers: true } },
      });
      usersToNotify.push(activity.user);
    }

    const seenIds = new Set<number>();
    const uniqueUsersToNotify = usersToNotify.filter((user) => {
      if (seenIds.has(user.id)) return false;
      seenIds.add(user.id);
      return true;
    });
    const authorDto = new ProfileDto(comment.author);

    await this.notifsService.sendUnreadContents(
      uniqueUsersToNotify
        // parentAuthor is notified via createForumReplyNotif below; skip here to avoid a duplicate
        .filter(
          (user) =>
            user.id !== comment.authorId && user.id !== parentAuthor?.id,
        )
        .map((user) => {
          return {
            user,
            contentType: UnreadContentType.ForumReply,
            contentId: comment.id,
            sendTime: comment.createdAt,
          };
        }),
    );

    const cid = generateCIDForNotif();
    if (parentAuthor && parentAuthor.id !== comment.authorId) {
      await this.notifsService.createForumReplyNotif(comment, parentAuthor);

      // special text/email notifs
      if (comment.parentObjectType === CommentParentObject.Post) {
        const post = await this.postRepository.findOneOrFail({
          where: { id: comment.parentObjectId },
          select: {
            id: true,
            title: true,
            notifyForReplies: true,
          },
        });
        if (post.notifyForReplies && parentAuthor.receiveReplyNotifications) {
          const url = withCid(commentUrl(comment, undefined, true), cid);
          if (userActionNotifsEnabled_text(parentAuthor)) {
            await this.mmsService.sendMms({
              to: parentAuthor.phoneNumber!,
              body: `${authorDto.displayName} replied to your comment on ${post.title}: ${url}`,
              mediaUrls: [],
              cid,
            });
          } else if (userActionNotifsEnabled_email(parentAuthor)) {
            await this.mailService.sendMail({
              recipient: parentAuthor.email!,
              emailType: EmailType.ForumReply,
              subject: `${authorDto.displayName} replied to your comment on ${post.title}`,
              context: {
                url,
                displayName: authorDto.displayName,
                postTitle: post.title,
              },
              cid,
            });
          } else {
            this.eventLogService.sendMessage({
              type: EventType.ForumReplyNotifFailure,
              message: `Did not notify ${parentAuthor.name} on ${post.title} because they have not enabled text/email notifications`,
              userId: comment.authorId,
              blob: {
                postId: post.id,
                commentId: comment.id,
                parentAuthorName: parentAuthor.name,
                authorName: authorDto.displayName,
              },
            });
          }
        }
      }
    }
  }

  async updateComment(
    id: number,
    updateCommentDto: UpdateCommentDto,
    userId: number,
  ): Promise<Comment> {
    const reply = await this.commentRepository.findOne({
      where: { id },
      relations: { author: true, editableContent: true },
    });

    if (!reply) {
      throw new NotFoundException(`Reply with ID "${id}" not found`);
    }

    if (reply.authorId !== userId) {
      throw new NotFoundException("You can only edit your own replies");
    }

    if (updateCommentDto.editableContent && reply.editableContent) {
      const ec = await this.editableContentRepository.findOneBy({
        id: reply.editableContent.id,
      });
      if (ec) {
        ec.body = updateCommentDto.editableContent.body ?? ec.body;
        ec.attachments =
          updateCommentDto.editableContent.attachments ?? ec.attachments;
        await this.editableContentRepository.save(ec);
      }
    }
    const updatedReply = await this.commentRepository.findOne({
      where: { id },
      relations: { author: true, editableContent: true },
    });

    if (!updatedReply) {
      throw new NotFoundException(
        `Reply with ID "${id}" not found after update`,
      );
    }
    await this.aiDetectionQueueService.addDetectJob({
      entityType: DetectableEntity.Comment,
      entityId: updatedReply.id,
    });
    return updatedReply;
  }

  async refreshLikesCount(comment: Comment): Promise<void> {
    const result = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin("comment.likes", "like")
      .where("comment.id = :id", { id: comment.id })
      .select("COUNT(*)", "count")
      .getRawOne<{ count: string }>();
    await this.commentRepository.update(comment.id, {
      likesCount: Number(result?.count ?? 0),
    });
  }

  async likePostOrComment(
    id: number,
    userId: number,
    unlike = false,
    type: "comment" | "post",
  ): Promise<void> {
    const object =
      type === "comment"
        ? await this.commentRepository.findOne({
            where: { id },
            relations: { likes: true, author: true, editableContent: true },
          })
        : await this.postRepository.findOne({
            where: { id },
            relations: { likes: true, author: true, authors: true },
          });

    if (!object) {
      throw new NotFoundException(`${type} with ID "${id}" not found`);
    }

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    const likes = object.likes ?? [];
    if (unlike) {
      if (!likes.some((like) => like.id === userId)) {
        throw new NotFoundException(`User has not liked this ${type}`);
      }
    } else if (likes.some((like) => like.id === userId)) {
      throw new NotFoundException(`User has already liked this ${type}`);
    }
    const likeRows = this.postRepository.manager
      .createQueryBuilder()
      .relation(type === "comment" ? Comment : Post, "likes")
      .of(id);
    try {
      await (unlike ? likeRows.remove(userId) : likeRows.add(userId));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new NotFoundException(`User has already liked this ${type}`);
    }

    if (type === "comment") {
      await this.refreshLikesCount(object as Comment);
    }

    if (!unlike) {
      if (type === "comment") {
        await this.sendCommentLikeNotification(object as Comment, user);
      } else {
        await this.sendPostLikeNotification(object as Post, user);
      }
    } else {
      if (type === "comment") {
        await this.removeCommentLikeNotification(object as Comment, user);
      } else {
        await this.removePostLikeNotification(object as Post, user);
      }
    }
  }

  private getUniquePostAuthors(post: Post): User[] {
    if (!post.author) {
      throw new Error(`Post ${post.id} was loaded without author`);
    }
    const allAuthors: User[] = [post.author];
    if (post.authors?.length) {
      allAuthors.push(...post.authors);
    }
    const seenIds = new Set<number>();
    return allAuthors.filter((u) => {
      if (seenIds.has(u.id)) return false;
      seenIds.add(u.id);
      return true;
    });
  }

  private async sendPostLikeNotification(post: Post, liker: User) {
    for (const owner of this.getUniquePostAuthors(post)) {
      if (owner.id === liker.id) {
        continue;
      }
      await this.likeNotificationService.createOrUpdate({
        owner,
        liker,
        targetType: "post",
        targetId: post.id,
        targetContent: post.title,
        webAppLocation: postUrl(post.id),
      });
    }
  }

  private async sendCommentLikeNotification(comment: Comment, liker: User) {
    if (!comment.author || comment.authorId === liker.id) {
      return;
    }
    let actionIdForActivity: number | undefined;
    if (comment.parentObjectType === CommentParentObject.Activity) {
      const activity = await this.actionActivityRepository.findOne({
        where: { id: comment.parentObjectId },
      });
      if (!activity) {
        return;
      }
      actionIdForActivity = activity.actionId;
    }
    const webAppLocation = commentUrl(comment, actionIdForActivity);
    if (!webAppLocation) {
      return;
    }
    await this.likeNotificationService.createOrUpdate({
      owner: comment.author,
      liker,
      targetType: "comment",
      targetId: comment.id,
      targetContent: comment.editableContent?.body ?? null,
      webAppLocation,
    });
  }

  private async removePostLikeNotification(post: Post, unliker: User) {
    for (const owner of this.getUniquePostAuthors(post)) {
      if (owner.id === unliker.id) {
        continue;
      }
      await this.likeNotificationService.removeOnUnlike({
        ownerId: owner.id,
        unlikerId: unliker.id,
        targetType: "post",
        targetId: post.id,
      });
    }
  }

  private async removeCommentLikeNotification(comment: Comment, unliker: User) {
    if (!comment.author || comment.authorId === unliker.id) {
      return;
    }
    await this.likeNotificationService.removeOnUnlike({
      ownerId: comment.authorId,
      unlikerId: unliker.id,
      targetType: "comment",
      targetId: comment.id,
    });
  }

  async deleteReply(id: number, userId: number): Promise<void> {
    const reply = await this.commentRepository.findOne({
      where: { id },
      relations: { notifications: true },
    });

    if (!reply) {
      throw new NotFoundException(`Reply with ID "${id}" not found`);
    }

    if (reply.authorId !== userId) {
      throw new NotFoundException("You can only delete your own replies");
    }

    for (const notification of reply.notifications) {
      await this.notifRepository.delete(notification.id);
    }

    await this.commentRepository.update(id, { deleted: true });
  }

  async findPostsByUser(userId: number): Promise<ParsedPost[]> {
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoin("post.authors", "coAuthor")
      .andWhere("(post.authorId = :userId OR coAuthor.id = :userId)", {
        userId,
      });
    this.addPostVisibilityFilter(qb, "post", userId);
    return (await qb.getMany()).map(parsePost);
  }

  async findCommentsByUser(userId: number): Promise<UserComment[]> {
    const comments = await this.commentRepository.find({
      where: {
        authorId: userId,
        deleted: false,
        parentObjectType: Not(CommentParentObject.Activity),
      },
      relations: { author: true, editableContent: true },
    });
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

    return comments.map((comment) => ({
      comment,
      parentTitle:
        comment.parentObjectType === CommentParentObject.Post
          ? posts.find((post) => post.id === comment.parentObjectId)?.title
          : comment.parentObjectType === CommentParentObject.Action
            ? actions.find((action) => action.id === comment.parentObjectId)
                ?.name
            : undefined,
    }));
  }

  async findForumCommentsByUser(userId: number): Promise<Comment[]> {
    return this.commentRepository.find({
      where: {
        authorId: userId,
        deleted: false,
        parentObjectType: CommentParentObject.Post,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: "DESC" },
    });
  }

  async findPostsByTitle(title: string): Promise<Post[]> {
    return this.postRepository.find({
      where: { title: ILike(`%${title}%`), deleted: false },
    });
  }

  /** Targets the join rows, so a concurrent write to the post's other half
   * cannot read this one into a stale snapshot and write it back. */
  private async replacePostUsers(params: {
    manager: EntityManager;
    postId: number;
    relation: "experts" | "authors";
    userIds: number[];
    currentIds: number[];
  }): Promise<void> {
    const { manager, postId, relation, userIds, currentIds } = params;
    const users =
      userIds.length > 0
        ? await manager.find(User, { where: { id: In(userIds) } })
        : [];
    const next = new Set(users.map((user) => user.id));
    const current = new Set(currentIds);
    await manager
      .createQueryBuilder()
      .relation(Post, relation)
      .of(postId)
      .addAndRemove(
        [...next].filter((id) => !current.has(id)),
        [...current].filter((id) => !next.has(id)),
      );
  }

  /** Locked so two writers cannot both diff against the same pre-state and
   * insert the same join row twice. */
  private async lockPost(
    manager: EntityManager,
    postId: number,
  ): Promise<Post> {
    const post = await manager.findOne(Post, {
      where: { id: postId },
      lock: { mode: "pessimistic_write" },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    return post;
  }

  private async findPostForAdmin(postId: number): Promise<ParsedPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: {
        author: true,
        action: { reviewers: true },
        editableContent: true,
        experts: true,
        authors: true,
        tags: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    return parsePost(post);
  }

  async updatePostExperts(
    postId: number,
    expertIds: number[],
    qaMode: boolean,
    expertLabel?: string | null,
    notifyForReplies?: boolean,
    showClusterTags?: boolean,
  ): Promise<ParsedPost> {
    await this.postRepository.manager.transaction(async (manager) => {
      const post = await this.lockPost(manager, postId);
      await manager.update(Post, postId, {
        qaMode,
        expertLabel,
        notifyForReplies,
        showClusterTags,
      });
      await this.replacePostUsers({
        manager,
        postId,
        relation: "experts",
        userIds: expertIds,
        currentIds: post.expertIds,
      });
    });

    return this.findPostForAdmin(postId);
  }

  async getPostsForAdmin(): Promise<ParsedPost[]> {
    const posts = await this.postRepository.find({
      where: { deleted: false },
      relations: {
        author: true,
        experts: true,
        authors: true,
        editableContent: true,
        tags: true,
      },
      order: { createdAt: "DESC" },
    });
    return posts.map(parsePost);
  }

  async updatePostAuthors(
    postId: number,
    authorIds: number[],
  ): Promise<ParsedPost> {
    await this.postRepository.manager.transaction(async (manager) => {
      const post = await this.lockPost(manager, postId);
      await this.replacePostUsers({
        manager,
        postId,
        relation: "authors",
        userIds: authorIds,
        currentIds: post.authorIds,
      });
      // Post lists order by updatedAt, which the join rows alone leave untouched.
      await manager.update(Post, postId, { updatedAt: new Date() });
    });

    return this.findPostForAdmin(postId);
  }

  async updatePostTags(
    postId: number,
    { tags: tagInputs, knownTagIds }: UpdatePostTagsDto,
  ): Promise<ParsedPost> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    const names = tagInputs.map((input) => input.name);
    if (new Set(names).size !== names.length) {
      throw new BadRequestException("Tag names must be unique within a post");
    }

    await this.postTagRepository.manager.transaction(async (manager) => {
      const tagRepository = manager.getRepository(PostTag);
      const existing = await tagRepository.find({ where: { postId } });
      const existingIds = new Set(existing.map((tag) => tag.id));
      const known = new Set(knownTagIds);
      if (
        known.size !== existingIds.size ||
        [...existingIds].some((id) => !known.has(id))
      ) {
        throw new ConflictException(
          "Another admin changed this post's tags. Reload and try again.",
        );
      }
      const existingById = new Map(existing.map((tag) => [tag.id, tag]));
      const kept = tagInputs.map((input, index) => {
        if (input.id === undefined) {
          return tagRepository.create({
            postId,
            name: input.name,
            sortOrder: index,
          });
        }
        const tag = existingById.get(input.id);
        if (!tag) {
          throw new BadRequestException(
            `Tag ${input.id} does not belong to post ${postId}`,
          );
        }
        tag.name = input.name;
        tag.sortOrder = index;
        return tag;
      });
      const keptIds = new Set(
        kept.map((tag) => tag.id).filter((id) => id !== undefined),
      );
      const removed = existing.filter((tag) => !keptIds.has(tag.id));

      if (removed.length > 0) {
        await tagRepository.remove(removed);
      }
      await tagRepository.save(kept);
    });

    return parsePost(
      await this.postRepository.findOneOrFail({
        where: { id: postId },
        relations: {
          author: true,
          action: true,
          editableContent: true,
          tags: true,
        },
      }),
    );
  }

  async togglePinComment(commentId: number): Promise<Comment> {
    const comment = await this.commentRepository.findOneOrFail({
      where: { id: commentId },
      relations: { author: true, editableContent: true, likes: true },
    });

    comment.pinned = !comment.pinned;

    return this.commentRepository.save(comment);
  }
}
