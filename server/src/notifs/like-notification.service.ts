import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type EntityManager, type Repository } from 'typeorm';
import {
  Notification,
  NotificationCategory,
} from './entities/notification.entity';
import { User } from 'src/user/entities/user.entity';
import { ProfileDto } from 'src/user/dto/user.dto';
import { NotifsService } from './notifs.service';
import type { GlobalFeedActivityType } from 'src/actions/dto/action.dto';

export type LikeNotificationTarget =
  | 'post'
  | 'comment'
  | `activity:${GlobalFeedActivityType}`;

export type GroupingKey =
  | `activity_like:${number}`
  | `forum_like:post:${number}:user:${number}`
  | `forum_like:comment:${number}`
  | `like:${LikeNotificationTarget}:${number}`;

@Injectable()
export class LikeNotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepository: Repository<Notification>,
    private readonly notifsService: NotifsService,
  ) {}

  async createOrUpdate(params: {
    owner: User;
    liker: User;
    targetType: LikeNotificationTarget;
    targetId: number;
    webAppLocation: string;
    groupingKey?: GroupingKey;
    targetContent?: string;
  }): Promise<void> {
    const {
      owner,
      liker,
      targetType,
      targetId,
      webAppLocation,
      targetContent,
    } = params;

    if (!owner || owner.id === liker.id) {
      return;
    }

    const groupingKey = params.groupingKey ?? `like:${targetType}:${targetId}`;

    // Advisory lock on the groupingKey serializes create/update/delete for
    // this notification across all three code paths, including the
    // create-branch where there is no row yet to take a row lock on.
    await this.notifRepository.manager.transaction(async (manager) => {
      await this.acquireGroupingKeyLock(manager, groupingKey);
      const notifRepo = manager.getRepository(Notification);
      const existingNotif = await notifRepo.findOne({
        where: {
          user: { id: owner.id },
          groupingKey,
          category: NotificationCategory.Likes,
          readAt: IsNull(),
        },
        relations: { associatedUsers: true },
      });

      if (existingNotif) {
        if (
          (existingNotif.associatedUsers ?? []).some(
            (user) => user.id === liker.id,
          )
        ) {
          return;
        }

        existingNotif.targetContent =
          existingNotif.targetContent ?? targetContent;
        const updatedUsers = [...(existingNotif.associatedUsers ?? []), liker];
        existingNotif.associatedUsers = updatedUsers;
        existingNotif.groupingCount = updatedUsers.length;
        existingNotif.readAt = null;
        existingNotif.sendTime = new Date();
        existingNotif.shouldPush = true;
        existingNotif.pushClaimedBy = null;
        existingNotif.pushClaimedAt = null;
        existingNotif.pushDispatchedAt = null;
        existingNotif.message = this.buildMessage({
          targetType,
          count: updatedUsers.length,
          targetContent: existingNotif.targetContent,
          likerName:
            updatedUsers.length === 1
              ? new ProfileDto(updatedUsers[0]).displayName
              : undefined,
        });
        await notifRepo.save(existingNotif);
        return;
      }

      const likerProfile = new ProfileDto(liker);
      const newNotif = this.notifsService.createNotif({
        user: owner,
        associatedUsers: [liker],
        category: NotificationCategory.Likes,
        message: this.buildMessage({
          targetType,
          count: 1,
          targetContent,
          likerName: likerProfile.displayName,
        }),
        targetContent,
        webAppLocation,
        groupingKey,
        groupingCount: 1,
      });
      await notifRepo.save(newNotif);
    });
  }

  async removeOnUnlike(params: {
    ownerId: number;
    unlikerId: number;
    targetType: LikeNotificationTarget;
    targetId: number;
    groupingKey?: GroupingKey;
  }): Promise<void> {
    const { ownerId, unlikerId, targetType, targetId } = params;

    if (ownerId === unlikerId) {
      return;
    }

    const groupingKey = params.groupingKey ?? `like:${targetType}:${targetId}`;

    // Advisory lock on the groupingKey serializes this with createOrUpdate
    // (see matching lock there), including races where the notification row
    // doesn't exist yet. Only target unread notifications — a read
    // notification is a frozen record of what the owner already saw, and
    // editing it risks picking the wrong row when a read+unread pair shares
    // the same groupingKey.
    await this.notifRepository.manager.transaction(async (manager) => {
      await this.acquireGroupingKeyLock(manager, groupingKey);
      const notifRepo = manager.getRepository(Notification);
      const notif = await notifRepo.findOne({
        where: {
          user: { id: ownerId },
          groupingKey,
          category: NotificationCategory.Likes,
          readAt: IsNull(),
        },
        relations: { associatedUsers: true },
      });

      if (!notif) {
        return;
      }

      const updatedUsers = (notif.associatedUsers ?? []).filter(
        (u) => u.id !== unlikerId,
      );

      if (updatedUsers.length === 0) {
        await notifRepo.remove(notif);
        return;
      }

      notif.associatedUsers = updatedUsers;
      notif.groupingCount = updatedUsers.length;
      notif.message = this.buildMessage({
        targetType,
        count: updatedUsers.length,
        targetContent: notif.targetContent,
        likerName:
          updatedUsers.length === 1
            ? new ProfileDto(updatedUsers[0]).displayName
            : undefined,
      });
      // Intentionally don't reset shouldPush/sendTime/pushClaimed* — an unlike shouldn't trigger a new push.
      await notifRepo.save(notif);
    });
  }

  private async acquireGroupingKeyLock(
    manager: EntityManager,
    groupingKey: string,
  ): Promise<void> {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [groupingKey],
    );
  }

  async getActiveLikeNotification(params: {
    ownerId: number;
    targetType: LikeNotificationTarget;
    targetId: number;
    groupingKey?: GroupingKey;
  }): Promise<Notification | null> {
    const groupingKey =
      params.groupingKey ?? `like:${params.targetType}:${params.targetId}`;

    const notification = await this.notifRepository.findOne({
      where: {
        user: { id: params.ownerId },
        groupingKey,
        category: NotificationCategory.Likes,
        readAt: IsNull(),
      },
      relations: { associatedUsers: true },
    });

    if (!notification) {
      return null;
    }

    const dedupedUsers = this.dedupeAssociatedUsers(
      notification.associatedUsers ?? [],
    );

    if (dedupedUsers.length !== (notification.associatedUsers?.length ?? 0)) {
      notification.associatedUsers = dedupedUsers;
      notification.groupingCount = dedupedUsers.length;
      notification.message = this.buildMessage({
        targetType: params.targetType,
        count: dedupedUsers.length,
        targetContent: notification.targetContent,
        likerName:
          dedupedUsers.length === 1
            ? new ProfileDto(dedupedUsers[0]).displayName
            : undefined,
      });
      await this.notifRepository.save(notification);
    }

    return notification;
  }

  private buildMessage(params: {
    targetType: LikeNotificationTarget;
    count: number;
    targetContent?: string;
    likerName?: string;
  }): string {
    const { targetType, count, targetContent, likerName } = params;

    let label;
    switch (targetType) {
      case 'post':
        label = targetContent ? `post: ${targetContent}` : 'post';
        break;
      case 'comment':
        label = targetContent ? `comment: ${targetContent}` : 'comment';
        break;
      case 'activity:user_completed':
        label = targetContent
          ? `completion of: ${targetContent}`
          : 'action activity';
        break;
      case 'activity:user_submitted_follow_up_form':
        label = targetContent
          ? `follow-up to: ${targetContent}`
          : 'follow-up response';
        break;
      default:
        targetType satisfies never;
    }

    if (count === 1 && likerName) {
      return `${likerName} liked your ${label}`;
    }

    return `${count} people liked your ${label}`;
  }

  private dedupeAssociatedUsers(users: User[]): User[] {
    const seen = new Set<number>();
    const unique: User[] = [];
    for (const user of users) {
      if (!user || user.id === undefined || seen.has(user.id)) {
        continue;
      }
      seen.add(user.id);
      unique.push(user);
    }
    return unique;
  }
}
