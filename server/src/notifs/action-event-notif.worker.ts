// action-event-notif.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailStatus } from 'src/mail/mail.entity';
import { MailService, processKeywordReplacements } from 'src/mail/mail.service';
import { Mms } from 'src/mms/mms.entity';
import { MmsService } from 'src/mms/mms.service';
import { User } from 'src/user/entities/user.entity';
import { DataSource, In, MoreThan, QueryRunner, Repository } from 'typeorm';
import { actionUrl, withCid } from 'src/search/approutes';
import {
  ActionEvent,
  NotificationType,
} from '../actions/entities/action-event.entity';
import { Action } from '../actions/entities/action.entity';
import {
  ActionReminder,
  ReminderCohortType,
} from '../actions/entities/action-reminder.entity';
import { NotifsService } from '../notifs/notifs.service';
import { generateCIDForNotif } from './notif-utils';
import {
  ActionEventNotif,
  ActionEventNotifType,
} from './entities/action-event-notif.entity';
import {
  ActionEventReminderService,
  ANNOUNCEMENT_SUPPORTED_STATUSES,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  NotificationPlan,
  POST_MEMBER_ACTION_STATUSES,
} from './action-event-reminder.service';
import { ActionEventRecipientService } from './action-event-recipient.service';
import { NotificationChannel } from './notif-utils';
import {
  defaultEventTextAnnouncement,
  defaultEventTextMissedDeadline,
  defaultEventTextMissedSecondDeadline,
} from './textnotifcontents';
import { withPgAdvisoryLock } from './lock-utils';

export interface ActionEventNotificationContext {
  event: ActionEvent;
  deadlineEvent?: ActionEvent;
  type: ActionEventNotifType;
  user: User;
  action: Action;
  cid: string;
  isSecondMiss?: boolean;
  customEmailMessage?: string;
  customTextMessage?: string;
  customEmailSubject?: string;
}

const PROCESS_ONE_LOCK_KEY1 = 0xa11a;
const PROCESS_ONE_LOCK_KEY2 = 0xce01;

const typeToSentAtField: Partial<
  Record<ActionEventNotifType, keyof ActionEvent>
> = {
  [ActionEventNotifType.Announcement]: 'announcementNotifsSentAt',
  [ActionEventNotifType.MissedDeadline]: 'deadlineNotifsSentAt',
};

@Injectable()
export class ActionEventNotifWorker {
  private readonly logger = new Logger(ActionEventNotifWorker.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifsService: NotifsService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    private readonly recipientService: ActionEventRecipientService,
    private readonly reminderService: ActionEventReminderService,
  ) {}

  @Cron('*/3 * * * *')
  async dispatchDueNotifs() {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.SEND_DEV_NOTIFS !== '1'
    ) {
      return;
    }

    const ran = await withPgAdvisoryLock(
      this.dataSource,
      PROCESS_ONE_LOCK_KEY1,
      PROCESS_ONE_LOCK_KEY2,
      async (qr) => {
        const now = new Date();
        const windowStart = new Date(
          now.getTime() - NOTIFICATION_LOOKBACK_WINDOW_MS,
        );

        const duePlans = await this.reminderService.evaluateNotifications(
          windowStart,
          now,
        );
        this.logger.log('duePlans', duePlans.length);

        for (const plan of duePlans) {
          await this.processOne(qr, plan);
        }
      },
    );

    if (ran === null) {
      this.logger.log('processOne skipped bc of lock');
    }
  }

  processCustomReminderText(
    text: string,
    context: ActionEventNotificationContext,
  ): string {
    return processKeywordReplacements(text, context);
  }

  private async processOne(qr: QueryRunner, plan: NotificationPlan) {
    const manager = qr.manager;

    const event = await manager.getRepository(ActionEvent).findOne({
      where: { id: plan.referenceEvent.id },
      relations: ['action', 'action.participatingGroups'],
    });

    if (!event || !event.action) return;

    const type = plan.type;

    let reminder: ActionReminder | null = null;

    if (type === ActionEventNotifType.Reminder) {
      reminder = await manager.getRepository(ActionReminder).findOne({
        where: { id: plan.reminder.id },
        relations: [
          'memberActionEvent',
          'memberActionEvent.action',
          'memberActionEvent.action.participatingGroups',
          'users',
        ],
      });
      if (!reminder || reminder.sentAt) {
        return;
      }
    } else {
      const sentAtField = typeToSentAtField[type];
      if (
        (sentAtField && event[sentAtField]) ||
        event.date > new Date() ||
        event.sendNotifsTo === NotificationType.None
      ) {
        return;
      }

      if (
        type === ActionEventNotifType.Announcement &&
        !ANNOUNCEMENT_SUPPORTED_STATUSES.includes(event.newStatus)
      ) {
        return;
      }
    }

    const action = event.action;

    const users =
      type === ActionEventNotifType.Reminder &&
      reminder?.cohortType === ReminderCohortType.Custom
        ? await this.recipientService.filterForCompletion(reminder.users, event)
        : await this.recipientService.getFilteredUsersForEvent(event, type);

    const baseContext: Omit<ActionEventNotificationContext, 'user' | 'cid'> = {
      event,
      type,
      action,
      customEmailMessage: reminder?.emailMessage,
      customTextMessage: reminder?.textMessage,
      customEmailSubject: reminder?.emailSubject,
    };

    const deadlineEvent =
      (await manager.getRepository(ActionEvent).findOne({
        where: {
          action: { id: action.id },
          date: MoreThan(event.date),
          newStatus: In(Array.from(POST_MEMBER_ACTION_STATUSES)),
        },
        order: { date: 'ASC' },
      })) ?? undefined;

    for (const user of users) {
      const context: ActionEventNotificationContext = {
        ...baseContext,
        user,
        deadlineEvent,
        cid: await generateCIDForNotif(),
      };
      if (context.customEmailMessage) {
        context.customEmailMessage = this.processCustomReminderText(
          context.customEmailMessage,
          context,
        );
      }
      if (context.customTextMessage) {
        context.customTextMessage = this.processCustomReminderText(
          context.customTextMessage,
          context,
        );
      }

      if (type === ActionEventNotifType.MissedDeadline) {
        context.isSecondMiss = false; //TODO;
      }

      const notif = new ActionEventNotif();
      notif.user = user;
      notif.actionEvent = event;
      notif.channel = NotificationChannel.Email;
      notif.sent = false;
      notif.type = type;
      let sentAnyNotif = false;
      if (this.notifsService.shouldTextUser(user)) {
        sentAnyNotif = true;
        const result = await this.sendActionEventNotificationMms(context);

        if (result && !result.errorCode) {
          notif.sent = true;
        }
        notif.channel = NotificationChannel.Text;
        notif.mms = result;
      }
      if (!notif.sent && this.notifsService.shouldEmailUser(user)) {
        sentAnyNotif = true;
        notif.channel = NotificationChannel.Email;
        const result =
          await this.mailService.sendActionEventNotificationEmail(context);
        notif.mail = result;
        if (result.status === EmailStatus.Sent) {
          notif.sent = true;
        }
      } else {
        //TODO: pushes
      }
      if (sentAnyNotif) {
        await this.actionEventNotifsRepository.save(notif);
      }
    }

    this.logger.log('notifs sent for event ' + event.id);
    const sentAtField = typeToSentAtField[type];
    if (sentAtField) {
      (event[sentAtField] as Date | undefined) = new Date();
      await manager.getRepository(ActionEvent).save(event);
    } else if (type === ActionEventNotifType.Reminder && reminder) {
      reminder.sentAt = new Date();
      await manager.getRepository(ActionReminder).save(reminder);
    }
  }

  async sendActionEventNotificationMms(
    context: ActionEventNotificationContext,
  ): Promise<Mms | null> {
    let body = '';
    if (context.type === ActionEventNotifType.Announcement) {
      body = defaultEventTextAnnouncement[context.event.newStatus](context);
    } else if (context.type === ActionEventNotifType.Reminder) {
      if (context.customTextMessage) {
        body = context.customTextMessage;
      } else {
        const url = withCid(actionUrl(context.action.id, true), context.cid);
        body = `Reminder: ${context.action.name}. ${url}`;
      }
    } else if (context.type === ActionEventNotifType.MissedDeadline) {
      body = context.isSecondMiss
        ? defaultEventTextMissedSecondDeadline(context)
        : defaultEventTextMissedDeadline(context);
    } else {
      throw context.type satisfies never;
    }

    return this.mmsService.sendMms(
      context.user.phoneNumber!,
      body,
      [],
      context.cid,
    );
  }
}
