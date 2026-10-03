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

const unreadContentTarget = (row: UnreadContent) => {
  const type = unreadContentTargetType[row.contentType];
  return type ? [{ type, id: row.contentId }] : [];
};

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

/** Renders inbox rows, keyed by recipient; rows it omits are hidden. */
@Injectable()
export class NotificationRenderService {
  constructor(private readonly references: NotificationReferencesService) {}

  async renderNotifications(
    byRecipient: ReadonlyMap<number, Notification[]>,
  ): Promise<NotificationDto[]> {
    const notifs = [...byRecipient.values()].flat();
    const referenced = [...byRecipient].flatMap(([recipientId, rows]) =>
      rows
        .filter((notif) => rendersFromContent[notif.format])
        .map((notif) => ({
          recipientId,
          notif,
          content: parseNotificationContent(notif.content),
        })),
    );
    const referencedByRecipient = Map.groupBy(
      referenced,
      (entry) => entry.recipientId,
    );
    const references = await this.references.resolve({
      contents: referenced.map(({ content }) => content),
      targetsByRecipient: new Map(
        [...byRecipient.keys()].map((recipientId) => [
          recipientId,
          (referencedByRecipient.get(recipientId) ?? []).flatMap(
            ({ content }) => content.target ?? [],
          ),
        ]),
      ),
    });
    const renderedById = new Map(
      referenced.flatMap(({ recipientId, notif, content }) => {
        if (
          content.target &&
          !references.accessFor(recipientId).isAvailable(content.target)
        ) {
          return [];
        }
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
    byRecipient: ReadonlyMap<number, UnreadContent[]>,
  ): Promise<NotificationDto[]> {
    const parsed = [...byRecipient].flatMap(([recipientId, rows]) =>
      rows.map((row) => ({
        recipientId,
        row,
        content: rendersFromContent[row.format]
          ? parseNotificationContent(row.content)
          : legacyUnreadContent[row.contentType],
      })),
    );
    const references = await this.references.resolve({
      contents: parsed.map(({ content }) => content),
      targetsByRecipient: new Map(
        [...byRecipient].map(([recipientId, rows]) => [
          recipientId,
          rows
            .filter((row) => rendersFromContent[row.format])
            .flatMap(unreadContentTarget),
        ]),
      ),
      legacyTargets: [...byRecipient.values()]
        .flat()
        .filter((row) => !rendersFromContent[row.format])
        .flatMap(unreadContentTarget),
    });

    return parsed.flatMap(({ recipientId, row, content }) => {
      const access = rendersFromContent[row.format]
        ? references.accessFor(recipientId)
        : references.legacyAccess;
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
          const comment = access.comments.get(row.contentId);
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
          const actionUpdate = access.actionUpdates.get(row.contentId);
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
