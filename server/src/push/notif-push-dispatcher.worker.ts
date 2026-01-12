import { v4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { CreatePushMessage, PushService } from './push.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotifPushDispatcherWorker {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchPushes() {
    const dispatchID = v4().replace(/-/g, '');

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
      return;
    }

    const toSend = await this.notificationRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.user', 'u')
      .where('n.id IN (:...ids)', { ids: claimed.map((c) => c.id) })
      .orderBy('n."sendTime"', 'ASC')
      .getMany();

    if (toSend.length === 0) {
      return;
    }

    console.log(`found ${toSend.length} notifs to send pushes for`);

    const messagesToSend: CreatePushMessage[] = [];
    for (const notif of toSend) {
      const notifTypeToSendable: Record<NotificationCategory, boolean> = {
        [NotificationCategory.ActionEvent]: true,
        [NotificationCategory.ActionUpdate]: true,
        [NotificationCategory.ForumReply]: notif.user.pushesForComments,
        [NotificationCategory.FriendRequest]:
          notif.user.pushesForFriendRequests,
        [NotificationCategory.FriendRequestAccepted]:
          notif.user.pushesForFriendRequests,
        [NotificationCategory.Likes]: notif.user.pushesForLikes,
        [NotificationCategory.CommunityInviteRejected]: true,
        [NotificationCategory.CommunityInviteAccepted]: true,
        [NotificationCategory.OnetimeInviteRequestCreated]: true,
        [NotificationCategory.OnetimeInviteRequestApproved]: true,
        [NotificationCategory.OnetimeInviteRequestRejected]: true,
      };
      if (!notifTypeToSendable[notif.category]) {
        console.log(`notif ${notif.id} not sendable`);
        await this.notificationRepository.update(notif.id, {
          shouldPush: false,
        });
        continue;
      }
      messagesToSend.push(
        ...(await this.pushService.getPushForAllUserDevices(notif.user.id, {
          body: notif.message,
          screen: notif.mobileAppLocation || notif.webAppLocation,
          notification: notif,
          idempotencyKey: notif.id.toString(),
        })),
      );
    }

    await this.pushService.sendMessages(messagesToSend);
  }
}
