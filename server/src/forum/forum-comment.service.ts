import { hasContent } from "@alliance/common/editableContent";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ActionActivity,
  loadedActionActivityUser,
} from "src/actions/entities/action-activity.entity";
import { Action } from "src/actions/entities/action.entity";
import { AiDetectionQueueService } from "src/ai-detection/ai-detection-queue.service";
import { DetectableEntity } from "src/ai-detection/entities/ai-detection-result.entity";
import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { UnreadContentType } from "src/notifs/entities/unread-content.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { NotifsService } from "src/notifs/notifs.service";
import { commentUrl } from "src/search/approutes";
import { ProfileDto } from "src/user/dto/user.dto";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { IsNull, type EntityManager, type Repository } from "typeorm";
import { Notification } from "../notifs/entities/notification.entity";
import { User } from "../user/entities/user.entity";
import { assertCommentParentNotInStaffPreview } from "./comment-staff-preview";
import { CreateCommentDto, UpdateCommentDto } from "./dto/comment.dto";
import {
  Comment,
  CommentParentObject,
  loadedCommentAuthor,
} from "./entities/comment.entity";
import { EditableContent } from "./entities/editablecontent.entity";
import { PostTag } from "./entities/post-tag.entity";
import { Post } from "./entities/post.entity";
import { lockCommentDiscussion, lockLiveAuthor } from "./forum-locks";
import { ForumService } from "./forum.service";
import { isCommentHidden } from "./hidden-comments";
import { filterVisiblePosts } from "./post-visibility";

@Injectable()
export class ForumCommentService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(ActionActivity)
    private actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(EditableContent)
    private editableContentRepository: TypedRepository<EditableContent>,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly aiDetectionQueueService: AiDetectionQueueService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly forumService: ForumService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  private async resolveCommentTag(
    manager: EntityManager,
    createCommentDto: CreateCommentDto,
  ): Promise<number | null> {
    if (
      createCommentDto.parentObjectType !== CommentParentObject.Post ||
      createCommentDto.parentId
    ) {
      return null;
    }

    const tags = await manager.find(PostTag, {
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
    await assertCommentParentNotInStaffPreview(
      this.commentRepository.manager,
      createCommentDto,
    );
    if (createCommentDto.parentObjectType === CommentParentObject.Post) {
      await this.forumService.assertPostVisible(
        createCommentDto.parentObjectId,
        userId,
      );
    }

    if (!hasContent(createCommentDto.editableContent)) {
      throw new BadRequestException("Reply cannot be empty");
    }

    const reply = await this.commentRepository.manager.transaction(
      async (manager) => {
        await lockLiveAuthor(manager, userId);
        await lockCommentDiscussion({
          manager,
          parent: {
            parentObjectType: createCommentDto.parentObjectType,
            parentObjectId: createCommentDto.parentObjectId,
            parentId: createCommentDto.parentId ?? null,
          },
        });

        const tagId = await this.resolveCommentTag(manager, createCommentDto);

        const content = await manager.save(
          manager.create(EditableContent, {
            body: createCommentDto.editableContent.body,
            attachments: createCommentDto.editableContent.attachments ?? [],
          }),
        );

        if (createCommentDto.parentObjectType === CommentParentObject.Post) {
          await manager.update(Post, createCommentDto.parentObjectId, {
            updatedAt: new Date(),
          });
        }

        return manager.save(
          manager.create(Comment, {
            ...createCommentDto,
            tagId,
            authorId: userId,
            editableContent: content,
          }),
        );
      },
    );

    if (
      createCommentDto.parentObjectType === CommentParentObject.Action &&
      process.env.NODE_ENV === "production"
    ) {
      this.eventLogService.sendMessage({
        type: EventType.ActionComment,
        message: `New comment on action ${createCommentDto.parentObjectId}`,
        slackMessage: `New comment on action ${createCommentDto.parentObjectId} <@U08P0TJ283T> <@U08NU231VGS> - <${process.env.APP_URL}${commentUrl(reply)}|Open action>`,
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

  private async actionAndLinkedPostAuthors(actionId: number): Promise<User[]> {
    const [action, posts] = await Promise.all([
      this.actionRepository.findOne({
        where: { id: actionId },
        relations: { authors: true },
      }),
      filterVisiblePosts({
        qb: this.postRepository
          .createQueryBuilder("post")
          .innerJoinAndSelect("post.author", "author")
          .leftJoinAndSelect("post.authors", "authors")
          .where("post.actionId = :actionId", { actionId }),
        postAlias: "post",
      }).getMany(),
    ]);
    return [
      ...(action?.authors ?? []),
      ...posts.flatMap((post) => {
        if (!post.author || !post.authors) {
          throw new Error(`Post ${post.id} was loaded without its authors`);
        }
        return [post.author, ...post.authors];
      }),
    ];
  }

  async sendNotifsForNewComment(comment: Comment): Promise<void> {
    const usersToNotify: User[] = [];

    let parentAuthor: User | undefined;
    if (comment.parentId) {
      const parentReply = await this.commentRepository.findOne({
        where: { id: comment.parentId },
        relations: { author: { contractEvents: true } },
      });
      parentAuthor = parentReply ? loadedCommentAuthor(parentReply) : undefined;
    }

    if (comment.parentObjectType === CommentParentObject.Post) {
      const post = await this.postRepository.findOne({
        where: { id: comment.parentObjectId },
        relations: { author: true, authors: true },
      });
      if (post) {
        if (!post.author) {
          throw new Error(`Post ${post.id} was loaded without author`);
        }
        usersToNotify.push(post.author);
        if (post.authors?.length) {
          usersToNotify.push(...post.authors);
        }
      }
    }
    if (comment.parentObjectType === CommentParentObject.Activity) {
      const activity = await this.actionActivityRepository.findOne({
        where: { id: comment.parentObjectId },
        relations: { user: true, action: { reviewers: true } },
      });
      if (activity) {
        usersToNotify.push(loadedActionActivityUser(activity));
      }
    }
    const onAction = comment.parentObjectType === CommentParentObject.Action;
    if (onAction) {
      usersToNotify.push(
        ...(await this.actionAndLinkedPostAuthors(comment.parentObjectId)),
      );
    }

    const seenIds = new Set<number>();
    const uniqueUsersToNotify = usersToNotify.filter((user) => {
      if (seenIds.has(user.id)) return false;
      seenIds.add(user.id);
      return true;
    });
    const authorDto = new ProfileDto(loadedCommentAuthor(comment));

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
            authorId: comment.authorId,
            ...(onAction && { actionId: comment.parentObjectId }),
          };
        }),
    );

    if (parentAuthor && parentAuthor.id !== comment.authorId) {
      await this.notifsService.createForumReplyNotif(comment, parentAuthor);

      // special text/email notifs
      if (comment.parentObjectType === CommentParentObject.Post) {
        const post = await this.postRepository.findOne({
          where: { id: comment.parentObjectId },
          select: {
            id: true,
            title: true,
            notifyForReplies: true,
          },
        });
        if (post?.notifyForReplies) {
          const channels = await this.preferences.channelsFor(
            parentAuthor,
            NotificationKind.CommentsAndReplies,
          );
          const texting = channels.includes(NotificationChannel.Text);
          const emailing = channels.includes(NotificationChannel.Email);
          const url = commentUrl(comment, undefined, true);
          const tracking: TrackedMessage = {
            owner: { userId: parentAuthor.id },
            source: MessageSource.ForumReply,
            context: { postId: post.id, commentId: comment.id },
            actionEventNotifId: null,
          };
          if (texting) {
            await this.mmsService.sendMms({
              to: parentAuthor.phoneNumber!,
              userId: parentAuthor.id,
              body: `${authorDto.displayName} replied to your comment on ${post.title}: ${url}`,
              mediaUrls: [],
              tracking,
            });
          }
          if (emailing) {
            await this.mailService.sendMail({
              recipient: parentAuthor.email!,
              emailType: EmailType.ForumReply,
              subject: `${authorDto.displayName} replied to your comment on ${post.title}`,
              context: {
                url,
                displayName: authorDto.displayName,
                postTitle: post.title,
              },
              tracking,
            });
          }
          if (!texting && !emailing) {
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

    if (
      !reply ||
      (await isCommentHidden(this.commentRepository.manager, reply))
    ) {
      throw new NotFoundException("That reply is no longer here");
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
      throw new NotFoundException("That reply is no longer here");
    }
    await this.aiDetectionQueueService.addDetectJob({
      entityType: DetectableEntity.Comment,
      entityId: updatedReply.id,
    });
    return updatedReply;
  }

  async deleteReply(id: number, userId: number): Promise<void> {
    const reply = await findWithDeletedRoot(this.commentRepository.manager, {
      target: Comment,
      options: { where: { id } },
    }).getOne();

    if (!reply) {
      throw new NotFoundException("That reply is no longer here");
    }

    if (reply.authorId !== userId) {
      throw new NotFoundException("You can only delete your own replies");
    }

    const notifications = await this.commentRepository.manager.find(
      Notification,
      {
        select: { id: true },
        where: { comment: { id } },
      },
    );
    await softDeleteCascade(this.commentRepository.manager, {
      target: Notification,
      ids: notifications.map((notification) => notification.id),
    });

    await this.commentRepository.update(
      { id, deletedAt: IsNull() },
      {
        deletedAt: () => "CURRENT_TIMESTAMP",
        legacyDeleted: true,
        pinned: false,
      },
    );
  }
}
