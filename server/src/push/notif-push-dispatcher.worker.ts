import { v4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import {
  UnreadContent,
  UnreadContentType,
} from 'src/notifs/entities/unread-content.entity';
import { CreatePushMessage, PushService } from './push.service';
import { Injectable } from '@nestjs/common';
import { NotifsService } from 'src/notifs/notifs.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotifPushDispatcherWorker {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(UnreadContent)
    private readonly unreadContentRepository: Repository<UnreadContent>,
    private readonly notifsService: NotifsService,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchPushes() {
    if (
      !(
        process.env.NODE_ENV === 'production' ||
        process.env.SEND_DEV_NOTIFS === '1'
      )
    ) {
      return;
    }
    const dispatchID = v4().replace(/-/g, '');

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

    const toSend = await this.notificationRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.user', 'u')
      .where('n.id IN (:...ids)', { ids: claimed.map((c) => c.id) })
      .orderBy('n."sendTime"', 'ASC')
      .getMany();

    if (toSend.length === 0) {
      return [];
    }

    console.log(`found ${toSend.length} notifs to send pushes for`);

    const messages: CreatePushMessage[] = [];
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
        [NotificationCategory.CommunityInviteCreated]: true,
        [NotificationCategory.CommunityInviteRejected]: true,
        [NotificationCategory.CommunityInviteAccepted]: true,
        [NotificationCategory.RemovedFromCommunity]: true,
        [NotificationCategory.RemovedFromCommunityForLeader]: true,
        [NotificationCategory.MemberLeftCommunity]: true,
        [NotificationCategory.MemberJoinedCommunity]: true,
        [NotificationCategory.MemberSuspendedRemovedFromCommunity]: true,
        [NotificationCategory.CommunityAssigned]: true,
        [NotificationCategory.NewMemberReferred]: true,
        [NotificationCategory.OnetimeInviteRequestCreated]: true,
        [NotificationCategory.OnetimeInviteRequestApproved]: true,
        [NotificationCategory.OnetimeInviteRequestRejected]: true,
        [NotificationCategory.CommunityInviteRequestCreated]: true,
        [NotificationCategory.CommunityInviteRequestRejected]: true,
      };
      if (!notifTypeToSendable[notif.category]) {
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
            body: notif.message,
            screen: notif.mobileAppLocation || notif.webAppLocation,
            notification: notif,
            idempotencyKey: notif.id.toString(),
          },
          notif.sendTime,
        )),
      );
    }
    return messages;
  }

  private async findUnreadContentPushes(
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

    if (hydrated.length === 0) {
      return [];
    }

    const messages: CreatePushMessage[] = [];
    for (const { unreadContent, dto } of hydrated) {
      const contentTypeToSendable: Record<UnreadContentType, boolean> = {
        [UnreadContentType.ActionEvent]: true,
        [UnreadContentType.ActionUpdate]: true,
        [UnreadContentType.ForumReply]: unreadContent.user.pushesForComments,
      };
      if (!contentTypeToSendable[unreadContent.contentType]) {
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
            body: dto.message,
            screen: dto.mobileAppLocation ?? dto.webAppLocation ?? undefined,
            unreadContent,
            idempotencyKey: `uc-${unreadContent.id}`,
          },
          unreadContent.sendTime,
        )),
      );
    }
    console.log('returning messages', messages);

    return messages;
  }
}
