import { Injectable } from "@nestjs/common";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { actionUrl, commentUrl } from "src/search/approutes";
import { ProfileDto } from "src/user/dto/user.dto";
import { NotificationDto } from "./dto/notification.dto";
import {
  Notification,
  NotificationCategory,
} from "./entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "./entities/unread-content.entity";
import {
  ContentTargetType,
  parseNotificationContent,
  renderNotificationContent,
  rendersFromContent,
} from "./notification-content";
import { NotificationReferencesService } from "./notification-references.service";
import { getPreviewText } from "./preview-text";

const unreadContentTargetType = {
  [UnreadContentType.ForumReply]: ContentTargetType.Comment,
  [UnreadContentType.ActionUpdate]: ContentTargetType.ActionUpdate,
  [UnreadContentType.ActionEvent]: null,
} satisfies Record<UnreadContentType, ContentTargetType | null>;

const withoutDestination = { webAppLocation: "", mobileAppLocation: null };

/** Renders inbox rows; rows it omits are hidden. */
@Injectable()
export class NotificationRenderService {
  constructor(private readonly references: NotificationReferencesService) {}

  async renderNotifications(
    notifs: Notification[],
  ): Promise<NotificationDto[]> {
    const referenced = notifs
      .filter((notif) => rendersFromContent[notif.format])
      .map((notif) => ({
        notif,
        content: parseNotificationContent(notif.content),
      }));
    const references = await this.references.resolve({
      contents: referenced.map(({ content }) => content),
      targets: [],
    });
    const renderedById = new Map(
      referenced.flatMap(({ notif, content }) => {
        const rendered = renderNotificationContent({
          content,
          references,
          count: notif.groupingCount,
          participant: notif.associatedUsers?.[0],
        });
        return rendered ? [[notif.id, rendered] as const] : [];
      }),
    );

    return notifs.flatMap((notif) => {
      if (!rendersFromContent[notif.format]) {
        return [NotificationDto.fromNotification(notif)];
      }
      const rendered = renderedById.get(notif.id);
      if (!rendered) {
        return [];
      }
      return [
        NotificationDto.fromNotification({
          ...notif,
          message: rendered.message,
          ...(!rendered.destinationAvailable && withoutDestination),
        }),
      ];
    });
  }

  async renderUnreadContents(
    unreadContents: UnreadContent[],
  ): Promise<NotificationDto[]> {
    const references = await this.references.resolve({
      contents: [],
      targets: unreadContents.flatMap((unreadContent) => {
        const type = unreadContentTargetType[unreadContent.contentType];
        return type ? [{ type, id: unreadContent.contentId }] : [];
      }),
    });

    return unreadContents.flatMap((unreadContent) => {
      if (unreadContent.contentType === UnreadContentType.ForumReply) {
        const comment = references.comments.get(unreadContent.contentId);
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
                ? references.activityActionIds.get(comment.parentObjectId)
                : undefined,
            ),
            mobileAppLocation: commentUrl(
              comment,
              comment.parentObjectType === CommentParentObject.Activity
                ? references.activityActionIds.get(comment.parentObjectId)
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
        const actionUpdate = references.actionUpdates.get(
          unreadContent.contentId,
        );
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
