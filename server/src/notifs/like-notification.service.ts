import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type EntityManager, type Repository } from 'typeorm';
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

type LegacyGroupingKey =
  | `activity_like:${number}`
  | `forum_like:post:${number}:user:${number}`
  | `forum_like:comment:${number}`;

export type GroupingKey = `like:${LikeNotificationTarget}:${number}`;

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
    targetContent: string | null;
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

    const [groupingKey, legacyGroupingKey] = this.getGroupingKeys({
      targetType,
      targetId,
      ownerId: owner.id,
    });
    const compatibleGroupingKeys = [groupingKey, legacyGroupingKey];

    // Advisory lock on the groupingKey serializes create/update/delete for
    // this notification across all three code paths, including the
    // create-branch where there is no row yet to take a row lock on.
    await this.notifRepository.manager.transaction(async (manager) => {
      await this.acquireGroupingKeyLocks(manager, compatibleGroupingKeys);
      const notifRepo = manager.getRepository(Notification);
      const existingNotif = await notifRepo.findOne({
        where: {
          user: { id: owner.id },
          groupingKey: In(compatibleGroupingKeys),
          category: NotificationCategory.Likes,
          readAt: IsNull(),
        },
        relations: { associatedUsers: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      });

      if (existingNotif) {
        if (
          (existingNotif.associatedUsers ?? []).some(
            (user) => user.id === liker.id,
          )
        ) {
          if (existingNotif.groupingKey !== groupingKey) {
            await notifRepo.update(existingNotif.id, { groupingKey });
          }
          return;
        }

        existingNotif.groupingKey = groupingKey;
        existingNotif.targetContent ??= targetContent;
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
  }): Promise<void> {
    const { ownerId, unlikerId, targetType, targetId } = params;

    if (ownerId === unlikerId) {
      return;
    }

    const [groupingKey, legacyGroupingKey] = this.getGroupingKeys({
      targetType,
      targetId,
      ownerId,
    });
    const compatibleGroupingKeys = [groupingKey, legacyGroupingKey];

    // Advisory lock on the groupingKey serializes this with createOrUpdate
    // (see matching lock there), including races where the notification row
    // doesn't exist yet. Only target unread notifications — a read
    // notification is a frozen record of what the owner already saw, and
    // editing it risks picking the wrong row when a read+unread pair shares
    // the same groupingKey.
    await this.notifRepository.manager.transaction(async (manager) => {
      await this.acquireGroupingKeyLocks(manager, compatibleGroupingKeys);
      const notifRepo = manager.getRepository(Notification);
      const notif = await notifRepo.findOne({
        where: {
          user: { id: ownerId },
          groupingKey: In(compatibleGroupingKeys),
          category: NotificationCategory.Likes,
          readAt: IsNull(),
        },
        relations: { associatedUsers: true },
        order: { createdAt: 'ASC', id: 'ASC' },
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

      notif.groupingKey = groupingKey;
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

  private getGroupingKeys(params: {
    targetType: LikeNotificationTarget;
    targetId: number;
    ownerId: number;
  }): [GroupingKey, LegacyGroupingKey] {
    const { targetType, targetId, ownerId } = params;
    const groupingKey: GroupingKey = `like:${targetType}:${targetId}`;

    switch (targetType) {
      case 'post':
        return [groupingKey, `forum_like:post:${targetId}:user:${ownerId}`];
      case 'comment':
        return [groupingKey, `forum_like:comment:${targetId}`];
      case 'activity:user_completed':
      case 'activity:user_submitted_follow_up_form':
        return [groupingKey, `activity_like:${targetId}`];
      default:
        throw new Error(
          `Unknown like notification target: ${targetType satisfies never}`,
        );
    }
  }

  private async acquireGroupingKeyLocks(
    manager: EntityManager,
    groupingKeys: string[],
  ): Promise<void> {
    for (const groupingKey of [...groupingKeys].sort()) {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [groupingKey],
      );
    }
  }

  private buildMessage(params: {
    targetType: LikeNotificationTarget;
    count: number;
    targetContent: string | null;
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
}
