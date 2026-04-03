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
import { generateCIDForNotif } from './notif-utils';
import { PushService } from 'src/push/push.service';
import { ReminderCohortType } from 'src/actions/entities/reminder-group.entity';

export type UncompletedTaskSummary = { name: string; timeEstimate?: number };

const PROCESS_ONE_LOCK_KEY1 = 0xa11a;
const PROCESS_ONE_LOCK_KEY2 = 0xce01;

/**
 * True when send time is at or after the linked deadline event (proxy for post-deadline / “failed to complete” sends).
 * If `deadlineEvent` is missing on the group, returns false — skip logic does not apply.
 */
function isPostDeadlineReminderPlan(plan: NotificationPlan): boolean {
  const deadline = plan.group.deadlineEvent?.date;
  if (!deadline) return false;
  return plan.scheduledFor.getTime() >= deadline.getTime();
}

/** When passed from `processOne`, avoids re-querying for each channel (push / SMS / email). */
type ResolvedReminderKeywords = {
  uncompletedTasks: UncompletedTaskSummary[];
  uncompletedMembersInGroupCount?: number;
};

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

  async findUncompletedTasksForPlan(
    plan: NotificationPlan,
  ): Promise<UncompletedTaskSummary[]> {
    const tasks =
      (await this.actionsService.findUncompletedTasks(
        plan.user.id,
        plan.group.useSuiteTaskCount ? plan.group.actionSuite?.id : undefined,
      )) ?? [];
    const filtered = plan.group.excludeOptionalActions
      ? tasks.filter((task) => !task.optional)
      : tasks;
    return filtered.map((task) => ({
      name: task.name,
      timeEstimate: task.timeEstimate,
    }));
  }

  async processCustomReminderText(
    text: string,
    plan: NotificationPlan,
    cid: string,
    /** Pre-resolved from `processOne`, or a plain task list (e.g. tests / previews). */
    resolvedOrTasks?: ResolvedReminderKeywords | UncompletedTaskSummary[],
  ): Promise<string> {
    let uncompletedTasks: UncompletedTaskSummary[];
    let uncompletedMembersInGroupCount: number | undefined;

    if (resolvedOrTasks === undefined) {
      uncompletedTasks = await this.findUncompletedTasksForPlan(plan);
    } else if (Array.isArray(resolvedOrTasks)) {
      uncompletedTasks = resolvedOrTasks;
    } else {
      uncompletedTasks =
        resolvedOrTasks.uncompletedTasks ??
        (await this.findUncompletedTasksForPlan(plan));
      uncompletedMembersInGroupCount =
        resolvedOrTasks.uncompletedMembersInGroupCount;
    }
    if (
      plan.group.cohortType === ReminderCohortType.GroupLeadsWithUncompleted &&
      uncompletedMembersInGroupCount === undefined
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

    const uncompletedTasks = await this.findUncompletedTasksForPlan(plan);

    let uncompletedMembersInGroupCount: number | undefined;
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

    const postDeadline = isPostDeadlineReminderPlan(plan);
    const skipReminder =
      plan.group.cohortType === ReminderCohortType.GroupLeadsWithUncompleted
        ? postDeadline && uncompletedMembersInGroupCount === 0
        : postDeadline && uncompletedTasks.length === 0;

    const resolvedKeywords: ResolvedReminderKeywords = { uncompletedTasks };
    if (
      plan.group.cohortType === ReminderCohortType.GroupLeadsWithUncompleted &&
      uncompletedMembersInGroupCount !== undefined
    ) {
      resolvedKeywords.uncompletedMembersInGroupCount =
        uncompletedMembersInGroupCount;
    }

    if (skipReminder) {
      notif.sent = true;
      await this.actionEventNotifsRepository.save(notif);
      this.logger.log(
        `Skipping post-deadline reminder group ${plan.group.id} for user ${plan.user.id}: no uncompleted tasks (or no uncompleted group members for leader reminder)`,
      );
      return;
    }

    let sendingAnyNotif = false;
    if (shouldPushUser(plan.user)) {
      sendingAnyNotif = true;
      const pushMessage = await this.processCustomReminderText(
        plan.group.pushMessage,
        plan,
        cid,
        resolvedKeywords,
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
    if (shouldTextUser(plan.user)) {
      sendingAnyNotif = true;
      const textMessage = await this.processCustomReminderText(
        plan.group.textMessage,
        plan,
        cid,
        resolvedKeywords,
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
      notif.mms = result;
    }
    if (shouldEmailUser(plan.user)) {
      sendingAnyNotif = true;

      const emailMessage = await this.processCustomReminderText(
        plan.group.emailMessage,
        plan,
        cid,
        resolvedKeywords,
      );
      const emailSubject = await this.processCustomReminderText(
        plan.group.emailSubject,
        plan,
        cid,
        resolvedKeywords,
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
