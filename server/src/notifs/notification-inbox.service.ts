import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { addMilliseconds } from "date-fns";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { In, IsNull, LessThan, Not } from "typeorm";
import {
  NotificationDto,
  NotificationSourceType,
} from "./dto/notification.dto";
import {
  MarkUnreadContentReadDto,
  ReadAllNotificationsQueryDto,
} from "./dto/unread-content.dto";
import { Notification } from "./entities/notification.entity";
import { UnreadContent } from "./entities/unread-content.entity";
import { FORMATS_RENDERING_FROM_CONTENT } from "./notification-content";
import { NotificationRenderService } from "./notification-render.service";
import type {
  NotificationWithUser,
  UnreadContentWithUser,
} from "./notifs.service";

// Timestamps are stored to the microsecond but serialized to the
// millisecond, so a bound covers its whole millisecond.
const throughMillisecond = (date: Date): Date => addMilliseconds(date, 1);

@Injectable()
export class NotificationInboxService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: TypedRepository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: TypedRepository<UnreadContent>,
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
        where: { user: { id: userId }, sendTime: due, visible: true },
        relations: { associatedUsers: true, actionUpdate: true, comment: true },
      }),
      this.unreadContentRepository.find({
        where: { user: { id: userId }, sendTime: due, visible: true },
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
      visible: true,
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

  async setRead(
    id: number,
    userId: number,
    sourceType?: NotificationSourceType,
  ) {
    if (sourceType !== NotificationSourceType.UnreadContent) {
      const notif: NotificationWithUser | null =
        await this.notifsRepository.findOne({
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

    const unreadContent: UnreadContentWithUser | null =
      await this.unreadContentRepository.findOne({
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
}
