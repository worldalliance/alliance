// action-event-notif.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionsService } from 'src/actions/actions.service';
import { EmailStatus } from 'src/mail/mail.entity';
import { MailService, processKeywordReplacements } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { DataSource, QueryFailedError, type Repository } from 'typeorm';
import {
  shouldEmailUser,
  shouldPushUser,
  shouldTextUser,
} from '../notifs/notifs.service';
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  NotificationPlan,
} from './action-event-reminder.service';
import {
  ActionEventNotif,
  ActionEventNotifType,
} from './entities/action-event-notif.entity';
import { withPgAdvisoryLock } from './lock-utils';
import { generateCIDForNotif, NotificationChannel } from './notif-utils';
import { PushService } from 'src/push/push.service';
import { ReminderCohortType } from 'src/actions/entities/reminder-group.entity';

const PROCESS_ONE_LOCK_KEY1 = 0xa11a;
const PROCESS_ONE_LOCK_KEY2 = 0xce01;

@Injectable()
export class ActionEventNotifWorker {
  private readonly logger = new Logger(ActionEventNotifWorker.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly actionsService: ActionsService,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    private readonly reminderService: ActionEventReminderService,
    private readonly pushService: PushService,
  ) {}

  @Cron('*/3 * * * *')
  async dispatchDueNotifs() {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.SEND_DEV_NOTIFS !== '1'
    ) {
      return;
    }
    if (process.env.NODE_ENV === 'staging') {
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
    const uncompletedTasks = await this.actionsService.findUncompletedTasks(
      plan.user.id,
      plan.group.useSuiteTaskCount ? plan.group.actionSuite?.id : undefined,
    );

    let uncompletedMembersInGroupCount: number | undefined = undefined;
    if (
      plan.group.cohortType === ReminderCohortType.GroupLeadsWithUncompleted
    ) {
      uncompletedMembersInGroupCount = (
        await this.reminderService.findUncompletedMembersInCommunities(
          plan.group,
          plan.user,
        )
      ).length;
    }

    return processKeywordReplacements(text, {
      user: plan.user,
      action: plan.group.memberActionEvent.action,
      deadlineEvent: plan.group.deadlineEvent,
      cid,
      uncompletedTasksCount: uncompletedTasks.length,
      uncompletedMembersInGroupCount,
      uncompletedTasksNames: uncompletedTasks.map((task) => task.name),
      uncompletedTasksTime:
        uncompletedTasks.reduce(
          (acc, task) => acc + (task.timeEstimate ?? 0),
          0,
        ) + ' minutes',
    });
  }

  private async processOne(plan: NotificationPlan) {
    const cid = generateCIDForNotif();

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

    let sendingAnyNotif = false;
    if (shouldPushUser(plan.user)) {
      console.log('shouldPushUser', plan.user.name);
      sendingAnyNotif = true;
      const pushMessage = await this.processCustomReminderText(
        plan.group.pushMessage,
        plan,
        cid,
      );

      const pushes = await this.pushService.getPushForAllUserDevices(
        plan.user.id,
        {
          userId: plan.user.id,
          body: pushMessage,
          screen: '/',
          idempotencyKey: plan.group.id.toString(),
        },
      );

      const result = await this.pushService.sendMessages(pushes);
      notif.pushes = result;
      if (result.length > 0) {
        notif.sent = true;
      }
    }
    if (!notif.sent && shouldTextUser(plan.user)) {
      sendingAnyNotif = true;
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
    if (!notif.sent && shouldEmailUser(plan.user)) {
      sendingAnyNotif = true;
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
    }
    if (sendingAnyNotif) {
      await this.actionEventNotifsRepository.save(notif);
    }
  }
}
