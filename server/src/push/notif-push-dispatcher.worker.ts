import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CATEGORY_KIND,
  UNREAD_CONTENT_KIND,
} from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import type { NotificationDto } from "src/notifs/dto/notification.dto";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import {
  type NotificationWithUser,
  NotifsService,
} from "src/notifs/notifs.service";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import { v4 } from "uuid";
import { CreatePushMessage, PushService } from "./push.service";

const actionUpdatePushBody = (message: string) => `Update: ${message}`;

// A rendered row without a destination carries an empty `webAppLocation`.
const pushScreen = (dto: NotificationDto) =>
  dto.mobileAppLocation || dto.webAppLocation || undefined;

async function claimDuePushes(
  repository: TypedRepository<Notification> | Repository<UnreadContent>,
  dispatchID: string,
): Promise<number[]> {
  const table = repository.metadata.tableName;
  const claimed: { id: number }[] = (
    await repository.query(
      `
      WITH cte AS (
        SELECT t.id
        FROM "${table}" t
        WHERE t."sendTime" <= NOW()
          AND t."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM "user" u
            WHERE u.id = t."userId" AND u."deletedAt" IS NULL
          )
          AND t."shouldPush" = true
          AND t."pushClaimedBy" IS NULL
          AND t."pushDispatchedAt" IS NULL
          -- A row read before it came due (e.g. an action update seen on its page) still pushes.
          AND (t."readAt" IS NULL OR t."readAt" < t."sendTime")
        ORDER BY t."sendTime" ASC
        LIMIT 500
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "${table}" t
      SET "pushClaimedBy" = $1,
          "pushClaimedAt" = NOW()
      FROM cte
      WHERE t.id = cte.id
      RETURNING t.id;
      `,
      [dispatchID],
    )
  )[0];
  return claimed.map(({ id }) => id);
}

@Injectable()
export class NotifPushDispatcherWorker {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: TypedRepository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: Repository<UnreadContent>,
    private readonly notifsService: NotifsService,
    private readonly pushService: PushService,
    private readonly preferences: NotificationPreferencesService,
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
    const claimed = await claimDuePushes(
      this.notificationRepository,
      dispatchID,
    );

    if (!claimed.length) {
      return [];
    }

    const toSend: NotificationWithUser[] =
      await this.notificationRepository.find({
        where: { id: In(claimed) },
        relations: { user: true, associatedUsers: true },
        order: { sendTime: "ASC" },
      });

    if (toSend.length === 0) {
      return [];
    }

    console.log(`found ${toSend.length} notifs to send pushes for`);
    const dtoById = await this.notifsService.renderNotificationsForPush(toSend);
    const preferences = await this.preferences.load({
      userIds: toSend.map((notif) => notif.user.id),
      kinds: toSend.map((notif) => CATEGORY_KIND[notif.category]),
    });

    const messages: CreatePushMessage[] = [];
    for (const notif of toSend) {
      const dto = dtoById.get(notif.id);
      if (
        !dto ||
        !preferences.wants({
          userId: notif.user.id,
          kind: CATEGORY_KIND[notif.category],
          channel: NotificationChannel.Push,
        })
      ) {
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
            screen: pushScreen(dto),
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
    const claimed = await claimDuePushes(
      this.unreadContentRepository,
      dispatchID,
    );

    if (!claimed.length) {
      return [];
    }

    const hydrated = await this.notifsService.getUnreadContentsForPush(claimed);
    const shown = new Set(
      hydrated.map(({ unreadContent }) => unreadContent.id),
    );
    const hidden = claimed.filter((id) => !shown.has(id));
    if (hidden.length) {
      await this.unreadContentRepository.update(
        { id: In(hidden) },
        { shouldPush: false },
      );
    }

    if (hydrated.length === 0) {
      return [];
    }

    const preferences = await this.preferences.load({
      userIds: hydrated.map(({ unreadContent }) => unreadContent.user.id),
      kinds: hydrated.map(
        ({ unreadContent }) => UNREAD_CONTENT_KIND[unreadContent.contentType],
      ),
    });
    const messages: CreatePushMessage[] = [];
    for (const { unreadContent, dto } of hydrated) {
      if (
        !preferences.wants({
          userId: unreadContent.user.id,
          kind: UNREAD_CONTENT_KIND[unreadContent.contentType],
          channel: NotificationChannel.Push,
        })
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
            screen: pushScreen(dto),
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
