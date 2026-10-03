import { Injectable } from "@nestjs/common";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { actionUrl, commentUrl } from "src/search/approutes";
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
  LIVE_ACTION_UPDATE_TEXT,
  type NotificationContent,
  parseNotificationContent,
  renderNotificationContent,
  rendersFromContent,
  SegmentType,
} from "./notification-content";
import { NotificationReferencesService } from "./notification-references.service";
import { getPreviewText } from "./preview-text";

const unreadContentTargetType = {
  [UnreadContentType.ForumReply]: ContentTargetType.Comment,
  [UnreadContentType.ActionUpdate]: ContentTargetType.ActionUpdate,
  [UnreadContentType.ActionEvent]: null,
} satisfies Record<UnreadContentType, ContentTargetType | null>;

/** What a legacy row renders, which matches what it rendered before formats existed. */
const legacyUnreadContent = {
  [UnreadContentType.ForumReply]: {
    message: [
      { type: SegmentType.Participant },
      ": ",
      { type: SegmentType.CommentExcerpt },
    ],
  },
  [UnreadContentType.ActionUpdate]: LIVE_ACTION_UPDATE_TEXT,
  [UnreadContentType.ActionEvent]: { message: [] },
} satisfies Record<UnreadContentType, NotificationContent>;

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
    rows: UnreadContent[],
  ): Promise<NotificationDto[]> {
    const parsed = rows.map((row) => ({
      row,
      content: rendersFromContent[row.format]
        ? parseNotificationContent(row.content)
        : legacyUnreadContent[row.contentType],
    }));
    const references = await this.references.resolve({
      contents: parsed.map(({ content }) => content),
      targets: rows.flatMap((row) => {
        const type = unreadContentTargetType[row.contentType];
        return type ? [{ type, id: row.contentId }] : [];
      }),
    });

    return parsed.flatMap(({ row, content }) => {
      const base = {
        id: row.id,
        readAt: row.readAt,
        createdAt: row.createdAt,
        updatedAt: row.readAt ?? row.createdAt,
        sendTime: row.sendTime,
        contentType: row.contentType,
        contentId: row.contentId,
      };

      switch (row.contentType) {
        case UnreadContentType.ForumReply: {
          const comment = references.comments.get(row.contentId);
          const rendered =
            comment?.editableContent &&
            renderNotificationContent({
              content,
              references,
              count: null,
              participant: comment.author,
              commentExcerpt: getPreviewText(comment.editableContent.body),
            });
          if (!comment || !rendered) {
            return [];
          }
          const location = commentUrl(
            comment,
            comment.parentObjectType === CommentParentObject.Activity
              ? references.activityActionIds.get(comment.parentObjectId)
              : undefined,
          );
          return [
            NotificationDto.fromUnreadContent({
              ...base,
              category: NotificationCategory.ForumReply,
              message: rendered.message,
              webAppLocation: location,
              mobileAppLocation: location,
              associatedUsers: [comment.author],
            }),
          ];
        }
        case UnreadContentType.ActionUpdate: {
          const actionUpdate = references.actionUpdates.get(row.contentId);
          const rendered =
            actionUpdate &&
            renderNotificationContent({
              content,
              references,
              count: null,
              actionUpdateText: getPreviewText(actionUpdate.shortNotifString),
            });
          if (!actionUpdate || !rendered) {
            return [];
          }
          return [
            NotificationDto.fromUnreadContent({
              ...base,
              category: NotificationCategory.ActionUpdate,
              message: rendered.message,
              webAppLocation: actionUrl(actionUpdate.actionId),
              mobileAppLocation: actionUrl(actionUpdate.actionId),
              associatedUsers: [],
            }),
          ];
        }
        case UnreadContentType.ActionEvent:
          return [];
        default:
          throw new Error(
            `unknown unread content type: ${row.contentType satisfies never}`,
          );
      }
    });
  }
}
