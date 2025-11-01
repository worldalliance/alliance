// action-event-notif.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailStatus } from 'src/mail/mail.entity';
import { MailService, processKeywordReplacements } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { User } from 'src/user/entities/user.entity';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ActionEvent } from '../actions/entities/action-event.entity';
import { Action } from '../actions/entities/action.entity';
import { NotifsService } from '../notifs/notifs.service';
import { generateCIDForNotif } from './notif-utils';
import {
  ActionEventNotif,
  ActionEventNotifType,
} from './entities/action-event-notif.entity';
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  NotificationPlan,
} from './action-event-reminder.service';
import { NotificationChannel } from './notif-utils';
import { withPgAdvisoryLock } from './lock-utils';
import { ActionsService } from 'src/actions/actions.service';

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

@Injectable()
export class ActionEventNotifWorker {
  private readonly logger = new Logger(ActionEventNotifWorker.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifsService: NotifsService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly actionsService: ActionsService,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
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
      async () => {
        const now = new Date();
        const windowStart = new Date(
          now.getTime() - NOTIFICATION_LOOKBACK_WINDOW_MS,
        );

        const duePlans = await this.reminderService.evaluateNotifications(
          windowStart,
          now,
        );
        for (const plan of duePlans) {
          await this.processOne(plan);
        }
      },
    );

    if (ran === null) {
      this.logger.log('processOne skipped bc of lock');
    }
  }

  async processCustomReminderText(
    text: string,
    plan: NotificationPlan,
    cid: string,
  ): Promise<string> {
    return processKeywordReplacements(text, {
      user: plan.user,
      action: plan.group.memberActionEvent.action,
      deadlineEvent: plan.group.deadlineEvent,
      cid,
      uncompletedTasksCount: await this.actionsService.getUncompletedTasksCount(
        plan.user.id,
      ),
    });
  }

  private async processOne(plan: NotificationPlan) {
    const cid = await generateCIDForNotif();

    const idempotency_key = `reminder:${plan.group.id}:${plan.user.id}`;

    const plannedNotif = this.actionEventNotifsRepository.create({
      user: plan.user,
      reminderGroup: plan.group,
      channel: NotificationChannel.Email,
      sent: false,
      type: ActionEventNotifType.Reminder,
      idempotency_key,
    } satisfies Partial<ActionEventNotif>);

    let notif: ActionEventNotif;
    try {
      notif = await this.actionEventNotifsRepository.save(plannedNotif);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        this.logger.error(`skipping duplicate notif: ${error.message}`);
        return;
      }
      throw error;
    }

    let sentAnyNotif = false;
    if (this.notifsService.shouldTextUser(plan.user)) {
      sentAnyNotif = true;
      const textMessage = await this.processCustomReminderText(
        plan.group.textMessage,
        plan,
        cid,
      );
      const result = await this.mmsService.sendMms(
        plan.user.phoneNumber!,
        textMessage,
        [],
        cid,
      );

      if (result && !result.errorCode) {
        notif.sent = true;
      }
      notif.channel = NotificationChannel.Text;
      notif.mms = result;
    }
    if (!notif.sent && this.notifsService.shouldEmailUser(plan.user)) {
      sentAnyNotif = true;
      notif.channel = NotificationChannel.Email;

      const emailMessage = await this.processCustomReminderText(
        plan.group.emailMessage,
        plan,
        cid,
      );
      const emailSubject = await this.processCustomReminderText(
        plan.group.emailSubject,
        plan,
        cid,
      );

      const result = await this.mailService.sendActionEventNotificationEmail(
        emailSubject,
        emailMessage,
        cid,
        plan.user.email,
      );
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
}
