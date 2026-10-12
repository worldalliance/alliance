import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import {
  type NotificationWithUser,
  NotifsService,
} from "src/notifs/notifs.service";
import { notificationPushesEnabled } from "src/user/user.utils";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import { v4 } from "uuid";
import { CreatePushMessage, PushService } from "./push.service";

const unreadContentCategory: Record<UnreadContentType, NotificationCategory> = {
  [UnreadContentType.ActionEvent]: NotificationCategory.ActionEvent,
  [UnreadContentType.ActionUpdate]: NotificationCategory.ActionUpdate,
  [UnreadContentType.ForumReply]: NotificationCategory.ForumReply,
};

const actionUpdatePushBody = (message: string) => `Update: ${message}`;

@Injectable()
export class NotifPushDispatcherWorker {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: TypedRepository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: Repository<UnreadContent>,
    private readonly notifsService: NotifsService,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchPushes() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    const dispatchID = v4().replace(/-/g, "");

    const messagesToSend: CreatePushMessage[] = [];
    messagesToSend.push(...(await this.findNotificationPushes(dispatchID)));
    messagesToSend.push(...(await this.findUnreadContentPushes(dispatchID)));

    if (!messagesToSend.length) {
      return;
    }

    await this.pushService.sendMessages(messagesToSend);
  }

  async findNotificationPushes(
    dispatchID: string,
  ): Promise<CreatePushMessage[]> {
    const claimed: { id: number }[] = (
      await this.notificationRepository.query(
        `
        WITH cte AS (
          SELECT n.id
          FROM notification n
          WHERE n."sendTime" <= NOW()
            AND n."shouldPush" = true
            AND n."pushClaimedBy" IS NULL
            AND n."pushDispatchedAt" IS NULL
            AND (n."readAt" IS NULL OR n."readAt" < n."sendTime")
          ORDER BY n."sendTime" ASC
          LIMIT 500
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification n
        SET "pushClaimedBy" = $1,
            "pushClaimedAt" = NOW()
        FROM cte
        WHERE n.id = cte.id
        RETURNING n.id;
        `,
        [dispatchID],
      )
    )[0];

    if (!claimed.length) {
      return [];
    }

    const toSend: NotificationWithUser[] =
      await this.notificationRepository.find({
        where: { id: In(claimed.map((c) => c.id)) },
        relations: { user: true, associatedUsers: true },
        order: { sendTime: "ASC" },
      });

    if (toSend.length === 0) {
      return [];
    }

    console.log(`found ${toSend.length} notifs to send pushes for`);
    const dtoById = await this.notifsService.renderNotificationsForPush(toSend);

    const messages: CreatePushMessage[] = [];
    for (const notif of toSend) {
      const dto = dtoById.get(notif.id);
      if (!notificationPushesEnabled(notif.user, notif.category) || !dto) {
        await this.notificationRepository.update(notif.id, {
          shouldPush: false,
        });
        continue;
      }
      messages.push(
        ...(await this.pushService.getPushForAllUserDevices(
          notif.user.id,
          {
            userId: notif.user.id,
            body:
              notif.category === NotificationCategory.ActionUpdate
                ? actionUpdatePushBody(dto.message)
                : dto.message,
            screen: dto.mobileAppLocation || dto.webAppLocation || undefined,
            notification: notif,
            idempotencyKey: `${notif.id}-${notif.updatedAt.getTime()}`,
          },
          notif.sendTime,
        )),
      );
    }
    return messages;
  }

  async findUnreadContentPushes(
    dispatchID: string,
  ): Promise<CreatePushMessage[]> {
    const claimed: { id: number }[] = (
      await this.unreadContentRepository.query(
        `
        WITH cte AS (
          SELECT uc.id
          FROM unread_content uc
          WHERE uc."sendTime" <= NOW()
            AND uc."shouldPush" = true
            AND uc."pushClaimedBy" IS NULL
            AND uc."pushDispatchedAt" IS NULL
            -- A row read before it came due (e.g. an action update seen on its page) still pushes.
            AND (uc."readAt" IS NULL OR uc."readAt" < uc."sendTime")
          ORDER BY uc."sendTime" ASC
          LIMIT 500
          FOR UPDATE SKIP LOCKED
        )
        UPDATE unread_content uc
        SET "pushClaimedBy" = $1,
            "pushClaimedAt" = NOW()
        FROM cte
        WHERE uc.id = cte.id
        RETURNING uc.id;
        `,
        [dispatchID],
      )
    )[0];

    if (!claimed.length) {
      return [];
    }

    const hydrated = await this.notifsService.getUnreadContentsForPush(
      claimed.map((content) => content.id),
    );
    const shown = new Set(
      hydrated.map(({ unreadContent }) => unreadContent.id),
    );
    const hidden = claimed.filter((row) => !shown.has(row.id));
    if (hidden.length) {
      await this.unreadContentRepository.update(
        { id: In(hidden.map((row) => row.id)) },
        { shouldPush: false },
      );
    }

    if (hydrated.length === 0) {
      return [];
    }

    const messages: CreatePushMessage[] = [];
    for (const { unreadContent, dto } of hydrated) {
      if (
        !notificationPushesEnabled(
          unreadContent.user,
          unreadContentCategory[unreadContent.contentType],
        )
      ) {
        await this.unreadContentRepository.update(unreadContent.id, {
          shouldPush: false,
        });
        continue;
      }
      messages.push(
        ...(await this.pushService.getPushForAllUserDevices(
          unreadContent.user.id,
          {
            userId: unreadContent.user.id,
            body:
              unreadContent.contentType === UnreadContentType.ActionUpdate
                ? actionUpdatePushBody(dto.message)
                : dto.message,
            screen: dto.mobileAppLocation ?? dto.webAppLocation ?? undefined,
            unreadContent,
            idempotencyKey: `uc-${unreadContent.id}`,
          },
          unreadContent.sendTime,
        )),
      );
    }
    return messages;
  }
}
