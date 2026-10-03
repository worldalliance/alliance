import type { FeedActionActivity } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { In, IsNull, type EntityManager, type Repository } from "typeorm";
import {
  Notification,
  NotificationCategory,
} from "./entities/notification.entity";
import {
  action,
  joinMessage,
  NotificationFormat,
  parseNotificationContent,
  renderNotificationContent,
  SegmentType,
  type Labeled,
} from "./notification-content";
import { NotificationReferencesService } from "./notification-references.service";
import { NotifsService } from "./notifs.service";

export type LikeNotificationTarget =
  | "post"
  | "comment"
  | `activity:${FeedActionActivity}`;

type LegacyGroupingKey =
  | `activity_like:${number}`
  | `forum_like:post:${number}:user:${number}`
  | `forum_like:comment:${number}`;

export type GroupingKey = `like:${LikeNotificationTarget}:${number}`;

const likedBy = (liker: string | Labeled, target: (string | Labeled)[]) =>
  joinMessage([liker, " liked your ", ...target]);

const likedByCount = (count: string | Labeled, target: (string | Labeled)[]) =>
  joinMessage([count, " people liked your ", ...target]);

@Injectable()
export class LikeNotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepository: Repository<Notification>,
    private readonly notifsService: NotifsService,
    private readonly references: NotificationReferencesService,
  ) {}

  async createOrUpdate(params: {
    owner: User;
    liker: User;
    targetType: LikeNotificationTarget;
    targetId: number;
    webAppLocation: string;
    targetContent: string | null;
    /** An activity's action, referenced so its name stays current. */
    targetAction?: { id: number; name: string };
  }): Promise<void> {
    const {
      owner,
      liker,
      targetType,
      targetId,
      webAppLocation,
      targetContent,
      targetAction,
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
        order: { createdAt: "ASC", id: "ASC" },
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
        existingNotif.message = await this.storedMessage({
          manager,
          notif: existingNotif,
          targetType,
        });
        await notifRepo.save(existingNotif);
        return;
      }

      const target = this.targetLabel({
        targetType,
        targetContent,
        targetAction,
      });
      const newNotif = this.notifsService.createNotif({
        user: owner,
        associatedUsers: [liker],
        category: NotificationCategory.Likes,
        message: likedBy(
          {
            segment: { type: SegmentType.Participant },
            label: new ProfileDto(liker).displayName,
          },
          target,
        ),
        pluralMessage: likedByCount(
          { segment: { type: SegmentType.Count }, label: "1" },
          target,
        ),
        destination: null,
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
        order: { createdAt: "ASC", id: "ASC" },
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
      notif.message = await this.storedMessage({
        manager,
        notif,
        targetType,
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
      case "post":
        return [groupingKey, `forum_like:post:${targetId}:user:${ownerId}`];
      case "comment":
        return [groupingKey, `forum_like:comment:${targetId}`];
      case "activity:user_completed":
      case "activity:user_submitted_follow_up_form":
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
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [groupingKey],
      );
    }
  }

  /** Reads render referenced rows from `content`; this keeps the column current. */
  private async storedMessage(params: {
    manager: EntityManager;
    notif: Notification;
    targetType: LikeNotificationTarget;
  }): Promise<string> {
    const { manager, notif, targetType } = params;
    const users = notif.associatedUsers ?? [];
    switch (notif.format) {
      case NotificationFormat.Legacy:
        return this.buildMessage({
          targetType,
          count: users.length,
          targetContent: notif.targetContent,
          likerName:
            users.length === 1
              ? new ProfileDto(users[0]).displayName
              : undefined,
        });
      case NotificationFormat.Referenced: {
        const content = parseNotificationContent(notif.content);
        const rendered = renderNotificationContent({
          content,
          references: await this.references.resolve([content], manager),
          count: users.length,
          participant: users[0],
        });
        // Its action is gone, so the row is hidden and its text is moot.
        return rendered?.message ?? notif.message;
      }
      default:
        // A format from newer code, after a rollback: its text is that code's.
        notif.format satisfies never;
        return notif.message;
    }
  }

  private targetLabel(params: {
    targetType: LikeNotificationTarget;
    targetContent: string | null;
    targetAction?: { id: number; name: string };
  }): (string | Labeled)[] {
    const { targetType, targetContent, targetAction } = params;
    const label = (parts: {
      prefix: string;
      fallback: string;
      name: string | Labeled | null;
    }) => (parts.name ? [parts.prefix, parts.name] : [parts.fallback]);
    const activityName = targetAction ? action(targetAction) : targetContent;
    switch (targetType) {
      case "post":
        return label({
          prefix: "post: ",
          fallback: "post",
          name: targetContent,
        });
      case "comment":
        return label({
          prefix: "comment: ",
          fallback: "comment",
          name: targetContent,
        });
      case "activity:user_completed":
        return label({
          prefix: "completion of: ",
          fallback: "action activity",
          name: activityName,
        });
      case "activity:user_submitted_follow_up_form":
        return label({
          prefix: "follow-up to: ",
          fallback: "follow-up response",
          name: activityName,
        });
      default:
        throw new Error(
          `Unknown like notification target: ${targetType satisfies never}`,
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
    const target = this.targetLabel({ targetType, targetContent });
    return count === 1 && likerName
      ? likedBy(likerName, target).text
      : likedByCount(String(count), target).text;
  }
}
