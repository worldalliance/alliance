import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionUpdate } from 'src/actions/entities/action-update.entity';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { actionUrl, commentUrl } from 'src/search/approutes';
import { User } from 'src/user/entities/user.entity';
import { DeepPartial, In, IsNull, LessThan, type Repository } from 'typeorm';
import { ActionEventNotif } from './entities/action-event-notif.entity';
import {
  NotificationDto,
  NotificationSourceType,
} from './dto/notification.dto';
import { MarkUnreadContentReadDto } from './dto/unread-content.dto';
import {
  NOTIFICATION_CATEGORY_PRIORITIES,
  Notification,
  NotificationCategory,
} from './entities/notification.entity';
import {
  UnreadContent,
  UnreadContentType,
} from './entities/unread-content.entity';
import { NotifClickDto, NotifClickResponseDto } from './dto/notifclick.dto';
import { NotificationChannel } from './notif-utils';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { ProfileDto } from 'src/user/dto/user.dto';
import { remark } from 'remark';
import { toString as mdastToString } from 'mdast-util-to-string';

export type CreateNotifParams = Required<
  Pick<
    DeepPartial<Notification>,
    'user' | 'category' | 'message' | 'webAppLocation' | 'associatedUsers'
  >
> &
  DeepPartial<Notification>;

export type CreateUnreadContentParams = Required<
  Pick<DeepPartial<UnreadContent>, 'user' | 'contentType' | 'contentId'>
> &
  DeepPartial<UnreadContent>;

export function shouldEmailUser(user: User) {
  return (
    user.emailNotifsEnabled &&
    !user.turnedOffAllNotifs &&
    user.hasActiveContract
  );
}

export function shouldTextUser(user: User) {
  return (
    user.textNotifsEnabled &&
    !user.turnedOffAllNotifs &&
    user.phoneNumber &&
    user.hasActiveContract &&
    user.phoneNumberValidated &&
    !user.phoneNumberUnsubscribed &&
    user.preferredActionReminderChannel === NotificationChannel.Text
  );
}

export function shouldPushUser(user: User) {
  return (
    !user.turnedOffAllNotifs &&
    user.pushNotifsEnabled &&
    user.preferredActionReminderChannel === NotificationChannel.Push &&
    process.env.NODE_ENV === 'development'
  );
}

function getPreviewText(body: string) {
  const tree = remark().parse(body);
  const plainText = mdastToString(tree).replace(/\s+/g, ' ').trim();

  return plainText.length > 140
    ? `${plainText.slice(0, 137).trimEnd()}...`
    : plainText;
}

@Injectable()
export class NotifsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: Repository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: Repository<UnreadContent>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
  ) {}

  async findAll(userId: number): Promise<NotificationDto[]> {
    const [notifs, unreadContents] = await Promise.all([
      this.notifsRepository.find({
        where: { user: { id: userId }, sendTime: LessThan(new Date()) },
        relations: { associatedUsers: true, actionUpdate: true, comment: true },
      }),
      this.unreadContentRepository.find({
        where: { user: { id: userId }, sendTime: LessThan(new Date()) },
        order: { sendTime: 'DESC', createdAt: 'DESC' },
      }),
    ]);

    return [
      ...notifs.map((notif) => NotificationDto.fromNotification(notif)),
      ...(await this.hydrateUnreadContentDtos(unreadContents)),
    ];
  }

  findOne(id: number) {
    return this.notifsRepository.findOne({
      where: { id },
    });
  }

  async setRead(
    id: number,
    userId: number,
    sourceType?: NotificationSourceType,
  ) {
    if (sourceType !== NotificationSourceType.UnreadContent) {
      const notif = await this.notifsRepository.findOne({
        where: { id, user: { id: userId } },
        relations: { user: true },
      });
      if (notif) {
        if (notif.user.id !== userId) {
          throw new BadRequestException();
        }
        return this.notifsRepository.update(
          { id, readAt: IsNull() },
          { readAt: new Date() },
        );
      }
    }

    if (sourceType === NotificationSourceType.Notification) {
      throw new NotFoundException('Notif not found');
    }

    const unreadContent = await this.unreadContentRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { user: true },
    });
    if (!unreadContent) {
      throw new NotFoundException('Notif not found');
    }
    if (unreadContent.user.id !== userId) {
      throw new BadRequestException();
    }
    return this.unreadContentRepository.update(
      { id, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async setReadAll(userId: number) {
    await Promise.all([
      this.notifsRepository.update(
        { user: { id: userId }, readAt: IsNull() },
        { readAt: new Date() },
      ),
      this.unreadContentRepository.update(
        { user: { id: userId }, readAt: IsNull() },
        { readAt: new Date() },
      ),
    ]);
  }

  async setUnreadContentReadByContent(
    userId: number,
    dto: MarkUnreadContentReadDto,
  ) {
    if (!dto.contentIds.length) {
      return;
    }

    await this.unreadContentRepository.update(
      {
        user: { id: userId },
        contentType: dto.contentType,
        contentId: In(dto.contentIds),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
  }

  async notifsForUser(id: number) {
    return this.actionEventNotifsRepository.find({
      where: { user: { id } },
      relations: {
        user: true,
        mail: true,
        mms: true,
      },
    });
  }

  async notifLinkClick(body: NotifClickDto): Promise<NotifClickResponseDto> {
    const notif = await this.notifsRepository.findOne({
      where: { cid: body.cid },
    });
    if (notif) {
      await this.notifsRepository.update(notif.id, { readAt: new Date() });
    }

    const mms = await this.mmsService.setClickedLinkByCid(body.cid);
    if (mms) {
      return { mms: true };
    }
    await this.mailService.setClickedLinkByCid(body.cid);

    return { mms: false };
  }

  async createActionUpdateNotif(actionUpdate: ActionUpdate, user: User) {
    return this.sendUnreadContent({
      user,
      contentType: UnreadContentType.ActionUpdate,
      contentId: actionUpdate.id,
      sendTime: actionUpdate.date,
    });
  }

  async createForumReplyNotif(comment: Comment, user: User) {
    return this.sendUnreadContent({
      user,
      contentType: UnreadContentType.ForumReply,
      contentId: comment.id,
      sendTime: comment.createdAt,
    });
  }

  createNotif(notif: CreateNotifParams) {
    if (!notif.priority) {
      notif.priority = NOTIFICATION_CATEGORY_PRIORITIES[notif.category];
    }
    return this.notifsRepository.create(notif);
  }

  async sendNotif(notif: CreateNotifParams) {
    return this.notifsRepository.save(this.createNotif(notif));
  }

  async sendNotifs(notifs: CreateNotifParams[]) {
    return this.notifsRepository.save(notifs.map((n) => this.createNotif(n)));
  }

  createUnreadContent(unreadContent: CreateUnreadContentParams) {
    return this.unreadContentRepository.create({
      ...unreadContent,
      sendTime: unreadContent.sendTime ?? new Date(),
    });
  }

  async sendUnreadContent(unreadContent: CreateUnreadContentParams) {
    return this.unreadContentRepository.save(
      this.createUnreadContent(unreadContent),
    );
  }

  async sendUnreadContents(unreadContents: CreateUnreadContentParams[]) {
    return this.unreadContentRepository.save(
      unreadContents.map((content) => this.createUnreadContent(content)),
    );
  }

  async getUnreadContentsForPush(ids: number[]) {
    const unreadContents = await this.unreadContentRepository.find({
      where: { id: In(ids) },
      relations: { user: true },
      order: { sendTime: 'ASC' },
    });

    const dtos = await this.hydrateUnreadContentDtos(unreadContents);
    const dtoById = new Map(dtos.map((dto) => [dto.id, dto]));

    return unreadContents
      .map((unreadContent) => {
        const dto = dtoById.get(unreadContent.id);
        if (!dto) {
          return null;
        }
        return { unreadContent, dto };
      })
      .filter(
        (
          item,
        ): item is { unreadContent: UnreadContent; dto: NotificationDto } =>
          item !== null,
      );
  }

  private async hydrateUnreadContentDtos(
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
            relations: { author: true },
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
        if (!comment) {
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
            associatedUsers: [new ProfileDto(comment.author)],
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
