import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { actionUrl, commentUrl } from "src/search/approutes";
import { ProfileDto } from "src/user/dto/user.dto";
import { In, type Repository } from "typeorm";
import { NotificationDto } from "./dto/notification.dto";
import { NotificationCategory } from "./entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "./entities/unread-content.entity";
import { getPreviewText } from "./preview-text";

/** Renders unread-content inbox rows; rows it omits are hidden. */
@Injectable()
export class NotificationRenderService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
  ) {}

  async renderUnreadContents(
    unreadContents: UnreadContent[],
  ): Promise<NotificationDto[]> {
    const forumReplyIds = unreadContents
      .filter((content) => content.contentType === UnreadContentType.ForumReply)
      .map((content) => content.contentId);
    const actionUpdateIds = unreadContents
      .filter(
        (content) => content.contentType === UnreadContentType.ActionUpdate,
      )
      .map((content) => content.contentId);

    const [comments, actionUpdates] = await Promise.all([
      forumReplyIds.length
        ? this.commentRepository.find({
            where: { id: In(forumReplyIds), deleted: false },
            relations: { author: true, editableContent: true },
          })
        : Promise.resolve([]),
      actionUpdateIds.length
        ? this.actionUpdateRepository.find({
            where: { id: In(actionUpdateIds) },
            relations: { action: true },
          })
        : Promise.resolve([]),
    ]);

    const activityActionMap = new Map<number, number>();
    const activityIds = comments
      .filter(
        (comment) => comment.parentObjectType === CommentParentObject.Activity,
      )
      .map((comment) => comment.parentObjectId);
    if (activityIds.length) {
      const activities = await this.actionActivityRepository.find({
        where: { id: In(activityIds) },
        relations: { action: true },
      });
      for (const activity of activities) {
        activityActionMap.set(activity.id, activity.action.id);
      }
    }

    const commentById = new Map(
      comments.map((comment) => [comment.id, comment]),
    );
    const actionUpdateById = new Map(
      actionUpdates.map((update) => [update.id, update]),
    );

    return unreadContents.flatMap((unreadContent) => {
      if (unreadContent.contentType === UnreadContentType.ForumReply) {
        const comment = commentById.get(unreadContent.contentId);
        if (!comment?.editableContent) {
          return [];
        }

        return [
          NotificationDto.fromUnreadContent({
            id: unreadContent.id,
            category: NotificationCategory.ForumReply,
            message: `${new ProfileDto(comment.author).displayName}: ${getPreviewText(
              comment.editableContent.body,
            )}`,
            webAppLocation: commentUrl(
              comment,
              comment.parentObjectType === CommentParentObject.Activity
                ? activityActionMap.get(comment.parentObjectId)
                : undefined,
            ),
            mobileAppLocation: commentUrl(
              comment,
              comment.parentObjectType === CommentParentObject.Activity
                ? activityActionMap.get(comment.parentObjectId)
                : undefined,
            ),
            readAt: unreadContent.readAt,
            createdAt: unreadContent.createdAt,
            updatedAt: unreadContent.readAt ?? unreadContent.createdAt,
            sendTime: unreadContent.sendTime,
            associatedUsers: [comment.author],
            contentType: unreadContent.contentType,
            contentId: unreadContent.contentId,
          }),
        ];
      }

      if (unreadContent.contentType === UnreadContentType.ActionUpdate) {
        const actionUpdate = actionUpdateById.get(unreadContent.contentId);
        if (!actionUpdate) {
          return [];
        }

        return [
          NotificationDto.fromUnreadContent({
            id: unreadContent.id,
            category: NotificationCategory.ActionUpdate,
            message: getPreviewText(actionUpdate.shortNotifString),
            webAppLocation: actionUrl(actionUpdate.actionId),
            mobileAppLocation: actionUrl(actionUpdate.actionId),
            readAt: unreadContent.readAt,
            createdAt: unreadContent.createdAt,
            updatedAt: unreadContent.readAt ?? unreadContent.createdAt,
            sendTime: unreadContent.sendTime,
            associatedUsers: [],
            contentType: unreadContent.contentType,
            contentId: unreadContent.contentId,
          }),
        ];
      }

      return [];
    });
  }
}
