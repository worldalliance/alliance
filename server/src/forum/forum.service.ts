import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AiDetectionQueueService } from 'src/ai-detection/ai-detection-queue.service';
import { DetectableEntity } from 'src/ai-detection/entities/ai-detection-result.entity';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { commentUrl, postUrl, withCid } from 'src/search/approutes';
import { ProfileDto } from 'src/user/dto/user.dto';
import { ILike, In, Not, type Repository } from 'typeorm';
import { Notification } from '../notifs/entities/notification.entity';
import { UnreadContentType } from 'src/notifs/entities/unread-content.entity';
import { User } from '../user/entities/user.entity';
import {
  CommentDto,
  CreateCommentDto,
  UpdateCommentDto,
  UserCommentDto,
} from './dto/comment.dto';
import { CreatePostDto, PostDto, UpdatePostDto } from './dto/post.dto';
import { Comment, CommentParentObject } from './entities/comment.entity';
import { EditableContent } from './entities/editablecontent.entity';
import { Post } from './entities/post.entity';
import { Action } from 'src/actions/entities/action.entity';
import { LikeNotificationService } from 'src/notifs/like-notification.service';
import { EventLogService } from 'src/eventlog/eventlog.service';
import {
  NotifsService,
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_text,
} from 'src/notifs/notifs.service';
import { EventType } from 'src/eventlog/event-log.entity';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { generateCIDForNotif } from 'src/notifs/notif-utils';
import { EmailType } from 'src/mail/mail.entity';

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
    private editableContentRepository: Repository<EditableContent>,
    private readonly likeNotificationService: LikeNotificationService,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly aiDetectionQueueService: AiDetectionQueueService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
  ) {}

  async createPost(
    createPostDto: CreatePostDto,
    userId: number,
  ): Promise<Post> {
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
    return this.postRepository.save(post);
  }

  postIsVisible(post: Post, userId?: number): boolean {
    const isAuthor =
      userId !== undefined &&
      (post.authorId === userId || (post.authorIds ?? []).includes(userId));
    return (
      (!post.visibleAt || post.visibleAt < new Date() || isAuthor) &&
      !post.deleted
    );
  }

  async findAllPosts(userId?: number): Promise<PostDto[]> {
    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.action', 'action')
      .leftJoinAndSelect('post.editableContent', 'editableContent')
      .leftJoin(
        Comment,
        'comment',
        'comment.parentObjectId = post.id ' +
          'AND comment.parentObjectType = :parentType ' +
          'AND comment.deleted = false',
        { parentType: CommentParentObject.Post },
      )
      .where('post.deleted = :deleted', { deleted: false })
      .orderBy('post.updatedAt', 'DESC')
      // aggregate comment count
      .addSelect('COUNT(comment.id)', 'commentCount')
      // group by PKs of selected entities (Postgres-friendly)
      .groupBy('post.id')
      .addGroupBy('author.id')
      .addGroupBy('action.id')
      .addGroupBy('editableContent.id');

    const { entities: allPosts, raw: allRaw } = await qb.getRawAndEntities();

    // Filter by visibility in memory (user-specific logic)
    const visible = allPosts
      .map((post, index) => ({ post, raw: allRaw[index] }))
      .filter(({ post }) => this.postIsVisible(post, userId));

    if (!visible.length) {
      return [];
    }

    const posts = visible.map((v) => v.post);
    const raw = visible.map((v) => v.raw);
    const postIds = posts.map((p) => p.id);

    // 2) Fetch authors per post (ManyToMany can't be joined in the grouped query)
    const postsWithAuthors = await this.postRepository.find({
      where: { id: In(postIds) },
      relations: { authors: true },
    });
    const authorsByPostId = new Map(
      postsWithAuthors.map((p) => [p.id, p.authors]),
    );
    for (const post of posts) {
      post.authors = authorsByPostId.get(post.id) ?? [];
    }

    // 3) Fetch last comment per post in one query using DISTINCT ON (Postgres)
    const lastComments = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .leftJoinAndSelect('comment.editableContent', 'editableContent')
      .where('comment.parentObjectType = :parentType', {
        parentType: CommentParentObject.Post,
      })
      .andWhere('comment.deleted = false')
      .andWhere('comment.parentObjectId IN (:...postIds)', { postIds })
      .distinctOn(['comment.parentObjectId'])
      .orderBy('comment.parentObjectId', 'ASC')
      .addOrderBy('comment.createdAt', 'DESC') // latest for each post
      .getMany();

    const lastCommentByPostId = new Map<number, Comment>(
      lastComments.map((c) => [c.parentObjectId, c]),
    );

    return posts.map((post, index) => {
      const commentCount = Number(raw[index].commentCount ?? 0);
      const lastComment = lastCommentByPostId.get(post.id) ?? undefined;

      return new PostDto(post, {
        commentCount,
        lastComment,
      });
    });
  }

  async findPostsByAction(actionId: number): Promise<Post[]> {
    const posts = (
      await this.postRepository.find({
        where: { actionId, deleted: false },
        relations: {
          author: true,
          action: true,
          editableContent: true,
          authors: true,
        },
        order: { updatedAt: 'DESC' },
      })
    ).filter((post) => this.postIsVisible(post));

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

  async findOnePostFull(id: number, userId?: number): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: {
        author: true,
        action: true,
        editableContent: true,
        authors: true,
      },
    });

    if (!post || !this.postIsVisible(post, userId)) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return post;
  }

  async findOnePost(id: number, userId?: number): Promise<PostDto> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: {
        author: true,
        action: true,
        editableContent: true,
        authors: true,
      },
    });

    if (!post || !this.postIsVisible(post, userId)) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return new PostDto(post);
  }

  async findCommentsForPostRaw(postId: number): Promise<Comment[]> {
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });

    return allComments;
  }

  async findCommentsForPost(postId: number): Promise<Comment[]> {
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: postId,
        parentObjectType: CommentParentObject.Post,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: 'ASC' },
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
      order: { createdAt: 'DESC' },
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
      order: { createdAt: 'ASC' },
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
      order: { createdAt: 'ASC' },
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

  async findCommentsForAction(actionId: number): Promise<Comment[]> {
    const allComments = await this.commentRepository.find({
      where: {
        parentObjectId: actionId,
        parentObjectType: CommentParentObject.Action,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: 'ASC' },
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
  ): Promise<PostDto> {
    const post = await this.findOnePost(id, userId);

    if (
      post.authorId !== userId &&
      !post.authors?.some((author) => author.id === userId)
    ) {
      throw new NotFoundException('You can only edit your own posts');
    }

    await this.postRepository.update(id, {
      title: updatePostDto.title ?? post.title,
      actionId: updatePostDto.actionId ?? post.actionId,
      visibleAt: updatePostDto.visibleAt ?? post.visibleAt,
    });
    if (updatePostDto.editableContent) {
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
      throw new NotFoundException('You can only delete your own posts');
    }

    await this.postRepository.update(id, { deleted: true });
  }

  async createComment(
    createCommentDto: CreateCommentDto,
    userId: number,
  ): Promise<CommentDto> {
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
      throw new BadRequestException('Reply cannot be empty');
    }

    const content = this.editableContentRepository.create({
      body: createCommentDto.editableContent.body,
      attachments: createCommentDto.editableContent.attachments ?? [],
    });
    await this.editableContentRepository.save(content);

    const reply = this.commentRepository.create({
      ...createCommentDto,
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
      process.env.NODE_ENV === 'production'
    ) {
      this.eventLogService.sendMessage({
        type: EventType.ActionComment,
        message: `New comment on action ${createCommentDto.parentObjectId} <@U08P0TJ283T> <@U08NU231VGS> - <${process.env.APP_URL}/actions/${createCommentDto.parentObjectId}?replyId=${reply.id}|Open action>`,
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

    return new CommentDto(replyWithAuthor);
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
      usersToNotify.push(post.author);
      if (post.authors?.length) {
        usersToNotify.push(...post.authors);
      }
    }
    if (comment.parentObjectType === CommentParentObject.Activity) {
      const activity = await this.actionActivityRepository.findOneOrFail({
        where: { id: comment.parentObjectId },
        relations: { user: true, action: true },
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
        .filter((user) => user.id !== comment.authorId)
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
            await this.mmsService.sendMms(
              parentAuthor.phoneNumber!,
              `${authorDto.displayName} replied to your comment on ${post.title}: ${url}`,
              [],
              cid,
            );
          } else if (userActionNotifsEnabled_email(parentAuthor)) {
            await this.mailService.sendMail(
              parentAuthor.email!,
              EmailType.ForumReply,
              `${authorDto.displayName} replied to your comment on ${post.title}`,
              {
                url,
                displayName: authorDto.displayName,
                postTitle: post.title,
              },
              cid,
            );
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
      throw new NotFoundException('You can only edit your own replies');
    }

    if (updateCommentDto.editableContent) {
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
    const withLikes = await this.commentRepository.findOneOrFail({
      where: { id: comment.id },
      relations: { likes: true },
    });
    const likesCount = withLikes.likes.length;
    await this.commentRepository.update(comment.id, { likesCount });
  }

  async likePostOrComment(
    id: number,
    userId: number,
    unlike = false,
    type: 'comment' | 'post',
  ): Promise<Comment | Post> {
    const object =
      type === 'comment'
        ? await this.commentRepository.findOne({
            where: { id },
            relations: { likes: true, author: true },
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

    if (unlike) {
      if (!object.likes.some((like) => like.id === userId)) {
        throw new NotFoundException(`User has not liked this ${type}`);
      }

      object.likes = object.likes.filter((like) => like.id !== userId);
    } else {
      if (object.likes.some((like) => like.id === userId)) {
        throw new NotFoundException(`User has already liked this ${type}`);
      }

      object.likes.push(user);
    }
    const obj = await (type === 'comment'
      ? this.commentRepository.save(object)
      : this.postRepository.save(object));

    if (!unlike) {
      if (type === 'comment') {
        await this.sendCommentLikeNotification(object as Comment, user);
      } else {
        await this.sendPostLikeNotification(object as Post, user);
      }
    } else {
      if (type === 'comment') {
        await this.removeCommentLikeNotification(object as Comment, user);
      } else {
        await this.removePostLikeNotification(object as Post, user);
      }
    }

    return obj;
  }

  private getUniquePostAuthors(post: Post): User[] {
    const allAuthors: User[] = [];
    if (post.author) {
      allAuthors.push(post.author);
    }
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
        targetType: 'post',
        targetId: post.id,
        targetContent: post.title,
        webAppLocation: postUrl(post.id),
        groupingKey: `forum_like:post:${post.id}:user:${owner.id}`,
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
      targetType: 'comment',
      targetId: comment.id,
      targetContent: comment.editableContent?.body,
      webAppLocation,
      groupingKey: `forum_like:comment:${comment.id}`,
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
        targetType: 'post',
        targetId: post.id,
        groupingKey: `forum_like:post:${post.id}:user:${owner.id}`,
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
      targetType: 'comment',
      targetId: comment.id,
      groupingKey: `forum_like:comment:${comment.id}`,
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
      throw new NotFoundException('You can only delete your own replies');
    }

    for (const notification of reply.notifications) {
      await this.notifRepository.delete(notification.id);
    }

    await this.commentRepository.update(id, { deleted: true });
  }

  async findPostsByUser(userId: number): Promise<Post[]> {
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.action', 'action')
      .leftJoin('post.authors', 'coAuthor')
      .where('post.deleted = :deleted', { deleted: false })
      .andWhere('(post.authorId = :userId OR coAuthor.id = :userId)', {
        userId,
      })
      .getMany();
    return posts.filter((post) => this.postIsVisible(post, userId));
  }

  async findCommentsByUser(userId: number): Promise<UserCommentDto[]> {
    const comments = await this.commentRepository.find({
      where: {
        authorId: userId,
        deleted: false,
        parentObjectType: Not(CommentParentObject.Activity),
      },
      relations: { author: true },
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

    return comments.map(
      (comment) =>
        new UserCommentDto(
          comment,
          comment.parentObjectType === CommentParentObject.Post
            ? posts.find((post) => post.id === comment.parentObjectId)?.title
            : comment.parentObjectType === CommentParentObject.Action
              ? actions.find((action) => action.id === comment.parentObjectId)
                  ?.name
              : undefined,
        ),
    );
  }

  async findForumCommentsByUser(userId: number): Promise<Comment[]> {
    return this.commentRepository.find({
      where: {
        authorId: userId,
        deleted: false,
        parentObjectType: CommentParentObject.Post,
      },
      relations: { author: true, editableContent: true, likes: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findPostsByTitle(title: string): Promise<Post[]> {
    return this.postRepository.find({
      where: { title: ILike(`%${title}%`), deleted: false },
    });
  }

  async updatePostExperts(
    postId: number,
    expertIds: number[],
    qaMode: boolean,
    expertLabel?: string,
    notifyForReplies?: boolean,
  ): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: { author: true, action: true, editableContent: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    const experts =
      expertIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(expertIds) },
          })
        : [];

    post.experts = experts;
    post.qaMode = qaMode;
    post.expertLabel = expertLabel;
    if (notifyForReplies !== undefined) {
      post.notifyForReplies = notifyForReplies;
    }

    return this.postRepository.save(post);
  }

  async getPostsForAdmin(): Promise<Post[]> {
    return this.postRepository.find({
      where: { deleted: false },
      relations: { author: true, experts: true, authors: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updatePostAuthors(postId: number, authorIds: number[]): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: { author: true, action: true, editableContent: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    const authors =
      authorIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(authorIds) },
          })
        : [];

    post.authors = authors;

    return this.postRepository.save(post);
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
