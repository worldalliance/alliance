import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { generateCIDForNotif } from 'src/notifs/notif-utils';
import { withCid } from 'src/search/approutes';
import { ForumDigestPreference, User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { ForumDigestLog } from './entities/forum-digest-log.entity';

@Injectable()
export class ForumDigestService {
  private readonly logger = new Logger(ForumDigestService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ForumDigestLog)
    private readonly digestLogRepository: Repository<ForumDigestLog>,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async sendDigests(): Promise<void> {
    const now = new Date();
    const shouldSendWeeklyToday = this.shouldSendWeekly(now);

    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .innerJoinAndSelect('notification.user', 'user')
      .where('notification.category = :category', {
        category: NotificationCategory.ForumReply,
      })
      .andWhere('notification.read = false')
      .andWhere('notification.cleared = false')
      .andWhere('user.forumDigestPreference != :off', {
        off: ForumDigestPreference.Off,
      })
      .orderBy('notification.createdAt', 'ASC')
      .getMany();

    console.log(
      `Found ${notifications.length} notifications to send digests for`,
    );

    if (notifications.length === 0) {
      return;
    }

    const notificationsByUser = new Map<number, Notification[]>();

    for (const notification of notifications) {
      const user = notification.user;
      if (!user) {
        continue;
      }
      if (!this.shouldProcessUser(user, shouldSendWeeklyToday)) {
        continue;
      }
      notificationsByUser.set(user.id, [
        ...(notificationsByUser.get(user.id) ?? []),
        notification,
      ]);
    }

    for (const [userId, userNotifications] of notificationsByUser.entries()) {
      const user = userNotifications[0].user;
      if (!user) {
        continue;
      }

      if (user.turnedOffAllNotifs) {
        continue;
      }

      const digestDate = this.formatDigestDate(now);
      const alreadySent = await this.digestLogRepository.findOne({
        where: { user: { id: userId }, digestDate },
      });
      if (alreadySent) {
        continue;
      }

      const cidForNotif = await generateCIDForNotif();

      const digestItems = userNotifications.map((item) => ({
        message: item.message,
        url: withCid(this.getAbsoluteUrl(item.webAppLocation), cidForNotif),
        createdAt: this.formatTimestamp(item.createdAt),
      }));

      try {
        await this.mailService.sendForumDigestEmail(
          user.email,
          user.name,
          userNotifications.length,
          digestItems,
          cidForNotif,
        );
        await this.notificationRepository.update(
          userNotifications.map((item) => item.id),
          { read: true },
        );
        await this.digestLogRepository.save(
          this.digestLogRepository.create({
            user,
            digestDate,
            preferenceUsed: user.forumDigestPreference,
            notificationsCount: userNotifications.length,
            notificationIds: userNotifications.map((item) => item.id),
            notificationsSummary: digestItems,
          }),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send forum digest to user ${userId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  private shouldProcessUser(
    user: User,
    shouldSendWeeklyToday: boolean,
  ): boolean {
    if (user.forumDigestPreference === ForumDigestPreference.Off) {
      return false;
    }
    if (user.forumDigestPreference === ForumDigestPreference.Daily) {
      return true;
    }
    return shouldSendWeeklyToday;
  }

  private shouldSendWeekly(now: Date): boolean {
    return now.getUTCDay() === 1;
  }

  private formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  }

  private formatDigestDate(now: Date): string {
    return now.toISOString().slice(0, 10);
  }

  private getAbsoluteUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const appUrl = process.env.APP_URL ?? '';
    return `${appUrl}${path}`;
  }
}
