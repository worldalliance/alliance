import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import {
  Notification,
  NOTIFICATION_CATEGORY_PRIORITIES,
  NotificationCategory,
  NotifPriority,
} from "../entities/notification.entity";
import { UnreadContentType } from "../entities/unread-content.entity";

export enum NotificationSourceType {
  Notification = "notification",
  UnreadContent = "unread_content",
}

export type NotificationDtoArgs = {
  id: number;
  category: NotificationCategory;
  message: string;
  webAppLocation: string;
  mobileAppLocation?: string | null;
  readAt: Date | null;
  createdAt: Date;
  priority: NotifPriority;
  updatedAt: Date;
  sendTime: Date;
  associatedUsers: User[];
  sourceType: NotificationSourceType;
  contentType?: UnreadContentType;
  contentId?: number;
};

export class NotificationDto extends PickType(Notification, [
  "id",
  "category",
  "message",
  "priority",
  "webAppLocation",
  "mobileAppLocation",
  "readAt",
  "createdAt",
  "updatedAt",
  "sendTime",
]) {
  @ApiProperty({ type: ProfileDto, isArray: true })
  associatedUsers: ProfileDto[];

  @ApiProperty({
    enum: NotificationSourceType,
    enumName: "NotificationSourceType",
  })
  sourceType: NotificationSourceType;

  @ApiPropertyOptional({
    enum: UnreadContentType,
    enumName: "UnreadContentType",
  })
  contentType?: UnreadContentType;

  @ApiPropertyOptional()
  contentId?: number;

  constructor(input: NotificationDtoArgs) {
    super();
    this.id = input.id;
    this.category = input.category;
    this.message = input.message;
    this.webAppLocation = input.webAppLocation;
    this.mobileAppLocation = input.mobileAppLocation ?? null;
    this.readAt = input.readAt;
    this.createdAt = input.createdAt;
    this.priority = input.priority;
    this.updatedAt = input.updatedAt;
    this.sendTime = input.sendTime;
    this.associatedUsers = input.associatedUsers.map(
      (user) => new ProfileDto(user),
    );
    this.sourceType = input.sourceType;
    this.contentType = input.contentType;
    this.contentId = input.contentId;
  }

  static fromNotification(notification: Notification): NotificationDto {
    return new NotificationDto({
      id: notification.id,
      message: notification.message,
      category: notification.category,
      webAppLocation: notification.webAppLocation,
      mobileAppLocation: notification.mobileAppLocation,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      priority: notification.priority,
      updatedAt: notification.updatedAt,
      sendTime: notification.sendTime,
      sourceType: NotificationSourceType.Notification,
      contentType:
        notification.category === NotificationCategory.ForumReply
          ? UnreadContentType.ForumReply
          : notification.category === NotificationCategory.ActionUpdate
            ? UnreadContentType.ActionUpdate
            : undefined,
      contentId:
        notification.category === NotificationCategory.ForumReply
          ? notification.comment?.id
          : notification.category === NotificationCategory.ActionUpdate
            ? notification.actionUpdate?.id
            : undefined,
      associatedUsers: notification.associatedUsers ?? [],
    });
  }

  static fromUnreadContent(params: {
    id: number;
    category: NotificationCategory;
    message: string;
    webAppLocation: string;
    mobileAppLocation?: string;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    sendTime: Date;
    associatedUsers?: User[];
    contentType: UnreadContentType;
    contentId: number;
  }): NotificationDto {
    return new NotificationDto({
      id: params.id,
      message: params.message,
      category: params.category,
      webAppLocation: params.webAppLocation,
      mobileAppLocation: params.mobileAppLocation,
      readAt: params.readAt,
      createdAt: params.createdAt,
      priority: NOTIFICATION_CATEGORY_PRIORITIES[params.category],
      updatedAt: params.updatedAt,
      sendTime: params.sendTime,
      sourceType: NotificationSourceType.UnreadContent,
      contentType: params.contentType,
      contentId: params.contentId,
      associatedUsers: params.associatedUsers ?? [],
    });
  }
}
