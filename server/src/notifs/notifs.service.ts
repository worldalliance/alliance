import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { addMilliseconds } from "date-fns";
import { chunk } from "es-toolkit";
import { actionUpdateEntrySendTime } from "src/actions/action-update-visibility";
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
  Not,
  Raw,
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
  Notification,
  NOTIFICATION_CATEGORY_PRIORITIES,
} from "./entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "./entities/unread-content.entity";
import {
  type ContentTarget,
  type Destination,
  FORMATS_RENDERING_FROM_CONTENT,
  forumReplyContent,
  LIVE_ACTION_UPDATE_TEXT,
  type NotificationContent,
  NotificationFormat,
  type NotifMessage,
} from "./notification-content";
import {
  followsLiveActionUpdateText,
  NotificationRenderService,
} from "./notification-render.service";

export type CreateNotifParams = Required<
  Pick<
    DeepPartial<Notification>,
    "user" | "category" | "webAppLocation" | "associatedUsers"
  >
> &
  Omit<DeepPartial<Notification>, "message" | "format" | "content"> & {
    message: NotifMessage;
    /** Null when the location doesn't open a member or group. */
    destination: Destination | null;
    pluralMessage?: NotifMessage;
    target?: ContentTarget;
  };

type UnreadContentSource =
  | { contentType: UnreadContentType.ForumReply; authorId: number }
  | { contentType: UnreadContentType.ActionUpdate };

export type CreateUnreadContentParams = Required<
  Pick<DeepPartial<UnreadContent>, "user" | "contentId">
> &
  Omit<DeepPartial<UnreadContent>, "format" | "content" | "contentType"> &
  UnreadContentSource;

function unreadContentFor(source: UnreadContentSource): NotificationContent {
  switch (source.contentType) {
    case UnreadContentType.ForumReply:
      return forumReplyContent(source.authorId);
    case UnreadContentType.ActionUpdate:
      return LIVE_ACTION_UPDATE_TEXT;
    default:
      throw new Error(
        `unknown unread content source: ${source satisfies never}`,
      );
  }
}

// TypeORM bulk-inserts a saved array as one statement, and Postgres caps a
// statement at 65535 bind parameters. `UnreadContent` writes ~13 columns per
// row, so an unchunked "notify all members" send would start failing outright
// somewhere around 5k recipients.
const UNREAD_CONTENT_INSERT_CHUNK = 1000;

const byRecipient = <T extends { user: User }>(rows: T[]) =>
  Map.groupBy(rows, (row) => row.user.id);

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
      ...(await this.renderService.renderNotifications(
        new Map([[userId, notifs]]),
      )),
      ...(await this.renderService.renderUnreadContents(
        new Map([[userId, unreadContents]]),
      )),
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
    const unread = {
      user: { id: userId },
      sendTime: LessThan(new Date()),
      readAt: IsNull(),
    };
    const [legacyNotifCount, referencedNotifs, unreadContents] =
      await Promise.all([
        this.notifsRepository.count({
          where: {
            ...unread,
            format: Not(In(FORMATS_RENDERING_FROM_CONTENT)),
          },
        }),
        this.notifsRepository.find({
          where: { ...unread, format: In(FORMATS_RENDERING_FROM_CONTENT) },
          select: {
            id: true,
            format: true,
            content: true,
            groupingCount: true,
          },
        }),
        this.unreadContentRepository.find({ where: unread }),
      ]);
    // Counts only what findAll can show: rows the recipient can no longer open never render.
    const [shownNotifs, shownContents] = await Promise.all([
      this.renderService.renderNotifications(
        new Map([[userId, referencedNotifs]]),
      ),
      this.renderService.renderUnreadContents(
        new Map([[userId, unreadContents]]),
      ),
    ]);
    return legacyNotifCount + shownNotifs.length + shownContents.length;
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
    const sendTime = actionUpdateEntrySendTime(actionUpdate);
    return this.sendUnreadContents(
      users.map((user) => ({
        user,
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdate.id,
        sendTime,
      })),
      em,
    );
  }

  /**
   * Moves an update's entries that aren't due yet to `until`, so entries kept
   * back while it is unpublished arrive, and push, when it shows. Entries
   * already due were delivered and stay put.
   */
  async deferActionUpdateEntries(params: {
    actionUpdateId: number;
    until: Date;
    em: EntityManager;
  }) {
    const { actionUpdateId, until, em } = params;
    await em.update(
      UnreadContent,
      {
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdateId,
        pushClaimedBy: IsNull(),
        sendTime: Raw(
          (sendTime) => `${sendTime} > now() AND ${sendTime} < :until`,
          {
            until,
          },
        ),
      },
      { sendTime: until },
    );
  }

  /**
   * Renders the update's due entries that still follow its text, which keeps
   * that text in every one its recipient can see. Call before members stop
   * seeing the text: before an edit replaces it or unpublishing hides it. It
   * takes its own pool connections, so call it outside a transaction. An entry
   * that never rendered and that its recipient can't see right now keeps
   * following edits.
   */
  async freezeActionUpdateCopy(actionUpdateId: number) {
    const due = await this.unreadContentRepository.find({
      where: {
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdateId,
        format: In(FORMATS_RENDERING_FROM_CONTENT),
        sendTime: Raw((sendTime) => `${sendTime} <= clock_timestamp()`),
        content: followsLiveActionUpdateText(),
      },
      relations: { user: true },
      select: {
        id: true,
        format: true,
        content: true,
        contentType: true,
        contentId: true,
        readAt: true,
        createdAt: true,
        sendTime: true,
        user: { id: true },
      },
    });
    for (const rows of chunk(due, UNREAD_CONTENT_INSERT_CHUNK)) {
      await this.renderService.renderUnreadContents(byRecipient(rows));
    }
  }

  async createForumReplyNotif(comment: Comment, user: User) {
    return this.sendUnreadContent({
      user,
      contentType: UnreadContentType.ForumReply,
      contentId: comment.id,
      sendTime: comment.createdAt,
      authorId: comment.authorId,
    });
  }

  createNotif({
    message,
    destination,
    pluralMessage,
    target,
    ...notif
  }: CreateNotifParams) {
    return this.notifsRepository.create({
      ...notif,
      priority:
        notif.priority ?? NOTIFICATION_CATEGORY_PRIORITIES[notif.category],
      format: NotificationFormat.Referenced,
      message: message.text,
      content: {
        message: message.segments,
        ...(pluralMessage && { pluralMessage: pluralMessage.segments }),
        ...(destination && { destination }),
        ...(target && { target }),
      } satisfies NotificationContent,
    });
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
      format: NotificationFormat.Referenced,
      content: unreadContentFor(unreadContent),
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

    const dtos = await this.renderService.renderUnreadContents(
      byRecipient(unreadContents),
    );
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

  async renderNotificationsForPush(
    notifs: Notification[],
  ): Promise<Map<number, NotificationDto>> {
    const dtos = await this.renderService.renderNotifications(
      byRecipient(notifs),
    );
    return new Map(dtos.map((dto) => [dto.id, dto]));
  }
}
