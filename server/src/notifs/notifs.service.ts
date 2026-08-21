import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { toString as mdastToString } from "mdast-util-to-string";
import { remark } from "remark";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { actionUrl, commentUrl } from "src/search/approutes";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import {
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  LessThan,
  type Repository,
} from "typeorm";
import { NotifClickDto } from "./dto/notifclick.dto";
import {
  NotificationDto,
  NotificationSourceType,
} from "./dto/notification.dto";
import { MarkUnreadContentReadDto } from "./dto/unread-content.dto";
import { ActionEventNotif } from "./entities/action-event-notif.entity";
import {
  NOTIFICATION_CATEGORY_PRIORITIES,
  Notification,
  NotificationCategory,
} from "./entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "./entities/unread-content.entity";

export type CreateNotifParams = Required<
  Pick<
    DeepPartial<Notification>,
    "user" | "category" | "message" | "webAppLocation" | "associatedUsers"
  >
> &
  DeepPartial<Notification>;

export type CreateUnreadContentParams = Required<
  Pick<DeepPartial<UnreadContent>, "user" | "contentType" | "contentId">
> &
  DeepPartial<UnreadContent>;

// TypeORM bulk-inserts a saved array as one statement, and Postgres caps a
// statement at 65535 bind parameters. `UnreadContent` writes ~11 columns per
// row, so an unchunked "notify all members" send would start failing outright
// somewhere under 6k recipients.
const UNREAD_CONTENT_INSERT_CHUNK = 1000;

function getPreviewText(body: string) {
  const tree = remark().parse(body);
  const plainText = mdastToString(tree).replace(/\s+/g, " ").trim();

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

  async findAll(userId: number, limit?: number): Promise<NotificationDto[]> {
    const [notifs, unreadContents] = await Promise.all([
      this.notifsRepository.find({
        where: { user: { id: userId }, sendTime: LessThan(new Date()) },
        relations: { associatedUsers: true, actionUpdate: true, comment: true },
      }),
      this.unreadContentRepository.find({
        where: { user: { id: userId }, sendTime: LessThan(new Date()) },
        order: { sendTime: "DESC", createdAt: "DESC" },
      }),
    ]);

    const merged = [
      ...notifs.map((notif) => NotificationDto.fromNotification(notif)),
      ...(await this.hydrateUnreadContentDtos(unreadContents)),
    ].sort(
      (a, b) =>
        new Date(b.sendTime || b.createdAt).getTime() -
        new Date(a.sendTime || a.createdAt).getTime(),
    );

    const filtered = merged.filter(
      (n) => new Date(n.sendTime).getTime() <= new Date().getTime(),
    );

    return limit !== undefined ? filtered.slice(0, limit) : filtered;
  }

  async getUnreadCount(userId: number): Promise<number> {
    const [notifCount, unreadContentCount] = await Promise.all([
      this.notifsRepository.count({
        where: {
          user: { id: userId },
          sendTime: LessThan(new Date()),
          readAt: IsNull(),
        },
      }),
      this.unreadContentRepository.count({
        where: {
          user: { id: userId },
          sendTime: LessThan(new Date()),
          readAt: IsNull(),
        },
      }),
    ]);
    return notifCount + unreadContentCount;
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
      throw new NotFoundException("Notif not found");
    }

    const unreadContent = await this.unreadContentRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { user: true },
    });
    if (!unreadContent) {
      throw new NotFoundException("Notif not found");
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
        pushes: true,
      },
    });
  }

  async notifLinkClick(body: NotifClickDto): Promise<boolean> {
    const notif = await this.notifsRepository.findOne({
      where: { cid: body.cid },
    });
    if (notif) {
      await this.notifsRepository.update(notif.id, { readAt: new Date() });
    }

    const mms = await this.mmsService.setClickedLinkByCid(body.cid);
    if (mms) {
      return true;
    }
    await this.mailService.setClickedLinkByCid(body.cid);

    return false;
  }

  /**
   * Takes the whole audience at once so the caller can send it in the same
   * transaction as its own once-only guard.
   */
  async createActionUpdateNotifs(params: {
    actionUpdate: ActionUpdate;
    users: User[];
    em?: EntityManager;
  }) {
    const { actionUpdate, users, em } = params;
    return this.sendUnreadContents(
      users.map((user) => ({
        user,
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdate.id,
        sendTime: actionUpdate.date,
      })),
      em,
    );
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

  async hasNotifWithGroupingKey(
    userId: number,
    groupingKey: string,
  ): Promise<boolean> {
    return (
      (await this.notifsRepository.count({
        where: { user: { id: userId }, groupingKey },
      })) > 0
    );
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

  async sendUnreadContents(
    unreadContents: CreateUnreadContentParams[],
    em?: EntityManager,
  ) {
    const manager = em ?? this.unreadContentRepository.manager;
    return manager.save(
      UnreadContent,
      unreadContents.map((content) => this.createUnreadContent(content)),
      { chunk: UNREAD_CONTENT_INSERT_CHUNK },
    );
  }

  async getUnreadContentsForPush(ids: number[]) {
    const unreadContents = await this.unreadContentRepository.find({
      where: { id: In(ids) },
      relations: { user: true },
      order: { sendTime: "ASC" },
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
