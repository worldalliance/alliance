import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { addMilliseconds } from "date-fns";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import { Comment } from "src/forum/entities/comment.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
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
import {
  MarkUnreadContentReadDto,
  ReadAllNotificationsQueryDto,
} from "./dto/unread-content.dto";
import { ActionEventNotif } from "./entities/action-event-notif.entity";
import {
  NOTIFICATION_CATEGORY_PRIORITIES,
  Notification,
} from "./entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "./entities/unread-content.entity";
import { NotificationRenderService } from "./notification-render.service";

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

// Timestamps are stored to the microsecond but serialized to the
// millisecond, so a bound covers its whole millisecond.
const throughMillisecond = (date: Date): Date => addMilliseconds(date, 1);

@Injectable()
export class NotifsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: Repository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: Repository<UnreadContent>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly renderService: NotificationRenderService,
  ) {}

  async findAll(
    userId: number,
    limit?: number,
  ): Promise<{ loadedAt: Date; notifications: NotificationDto[] }> {
    // The database's clock, which createdAt uses; read-all bounds both
    // sendTime and createdAt by it.
    const [{ loadedAt }] = await this.notifsRepository.query<
      { loadedAt: Date }[]
    >('SELECT now() AS "loadedAt"');
    const due = LessThan(throughMillisecond(loadedAt));
    const [notifs, unreadContents] = await Promise.all([
      this.notifsRepository.find({
        where: { user: { id: userId }, sendTime: due },
        relations: { associatedUsers: true, actionUpdate: true, comment: true },
      }),
      this.unreadContentRepository.find({
        where: { user: { id: userId }, sendTime: due },
        order: { sendTime: "DESC", createdAt: "DESC" },
      }),
    ]);

    const merged = [
      ...notifs.map((notif) => NotificationDto.fromNotification(notif)),
      ...(await this.renderService.renderUnreadContents(unreadContents)),
    ].sort(
      (a, b) =>
        new Date(b.sendTime || b.createdAt).getTime() -
        new Date(a.sendTime || a.createdAt).getTime(),
    );

    return {
      loadedAt,
      notifications: limit !== undefined ? merged.slice(0, limit) : merged,
    };
  }

  async getUnreadCount(userId: number): Promise<number> {
    const [notifCount, unreadContents] = await Promise.all([
      this.notifsRepository.count({
        where: {
          user: { id: userId },
          sendTime: LessThan(new Date()),
          readAt: IsNull(),
        },
      }),
      this.unreadContentRepository.find({
        where: {
          user: { id: userId },
          sendTime: LessThan(new Date()),
          readAt: IsNull(),
        },
      }),
    ]);
    // Counts only what findAll can show: rows whose content is gone never render.
    const shown = await this.renderService.renderUnreadContents(unreadContents);
    return notifCount + shown.length;
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

  async setReadAll(userId: number, query: ReadAllNotificationsQueryDto) {
    const now = new Date();
    const through = query.loadedAt && throughMillisecond(query.loadedAt);
    const where = {
      user: { id: userId },
      readAt: IsNull(),
      sendTime: LessThan(through && through < now ? through : now),
      ...(through && { createdAt: LessThan(through) }),
    };
    await Promise.all([
      this.notifsRepository.update(where, { readAt: now }),
      this.unreadContentRepository.update(where, { readAt: now }),
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

    const dtos = await this.renderService.renderUnreadContents(unreadContents);
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
}
