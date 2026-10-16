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
import { UnreadContentType } from "src/notifs/entities/unread-content.entity";
import { NotifsService } from "src/notifs/notifs.service";
import { commentUrl } from "src/search/approutes";
import { ProfileDto } from "src/user/dto/user.dto";
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
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

@Injectable()
export class ForumCommentService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(ActionActivity)
    private actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(EditableContent)
    private editableContentRepository: TypedRepository<EditableContent>,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly aiDetectionQueueService: AiDetectionQueueService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly forumService: ForumService,
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

    if (
      !createCommentDto.editableContent.body &&
      (!createCommentDto.editableContent.attachments ||
        createCommentDto.editableContent.attachments.length === 0)
    ) {
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
        if (post?.notifyForReplies && parentAuthor.receiveReplyNotifications) {
          const url = commentUrl(comment, undefined, true);
          const tracking: TrackedMessage = {
            owner: { userId: parentAuthor.id },
            source: MessageSource.ForumReply,
            context: { postId: post.id, commentId: comment.id },
            actionEventNotifId: null,
          };
          if (userActionNotifsEnabled_text(parentAuthor)) {
            await this.mmsService.sendMms({
              to: parentAuthor.phoneNumber!,
              userId: parentAuthor.id,
              body: `${authorDto.displayName} replied to your comment on ${post.title}: ${url}`,
              mediaUrls: [],
              tracking,
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
              tracking,
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
