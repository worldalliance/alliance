// action-event-notif.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionsService } from 'src/actions/actions.service';
import {
  cohortNotifiesRecipientPersonally,
  ReminderCohortType,
} from 'src/actions/entities/reminder-group.entity';
import { EmailStatus } from 'src/mail/mail.entity';
import { MailService, processKeywordReplacements } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { PushService } from 'src/push/push.service';
import { DataSource, QueryFailedError, type Repository } from 'typeorm';
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from '../notifs/notifs.service';
import {
  ActionEventReminderService,
  groupTaskScopeActionIds,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  tasksNotYetNotified,
} from './action-event-reminder.service';
import { NotificationPlan } from './dto/notification-plan.dto';
import {
  ActionEventNotif,
  ActionEventNotifType,
} from './entities/action-event-notif.entity';
import { LOCK_KEYS } from './lock-keys';
import { withPgAdvisoryLock } from './lock-utils';
import { generateCIDForNotif } from './notif-utils';

export type UncompletedTaskSummary = {
  id: number;
  name: string;
  timeEstimate?: number;
};

const [PROCESS_ONE_LOCK_KEY1, PROCESS_ONE_LOCK_KEY2] =
  LOCK_KEYS.actionEventNotif;

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
      !(
        process.env.NODE_ENV === 'production' ||
        process.env.SEND_DEV_NOTIFS === '1'
      )
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

  async findUncompletedTasksForPlan(
    plan: NotificationPlan,
  ): Promise<UncompletedTaskSummary[]> {
    const tasks = await this.actionsService.findUncompletedTasks(
      plan.user.id,
      plan.group.useSuiteTaskCount ? plan.group.actionSuite?.id : undefined,
    );
    if (plan.group.excludeOptionalActions) {
      return tasks.filter((task) => !task.optional);
    }
    return tasks;
  }

  async processCustomReminderText(
    text: string,
    plan: NotificationPlan,
    cid: string,
    uncompletedTasks: UncompletedTaskSummary[],
  ): Promise<string> {
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

    let uncompletedTasks = await this.findUncompletedTasksForPlan(plan);

    if (plan.group.excludePreviouslyNotified) {
      // Re-derived at send time (not plan time) so a sibling group's send
      // earlier in this same dispatch cycle — invisible to the plan-time
      // snapshot — counts too. The user is skipped when their prior notifs
      // already cover the group's whole task scope, and otherwise the message
      // only enumerates the tasks they haven't been notified about.
      const coverage = await this.reminderService.findSentNotifCoverage(
        plan.user.id,
        plan.group.memberActionEvent.id,
      );
      const scopeNotYetNotified = tasksNotYetNotified(
        groupTaskScopeActionIds(plan.group).map((id) => ({ id })),
        coverage,
      );
      uncompletedTasks = tasksNotYetNotified(uncompletedTasks, coverage);
      if (scopeNotYetNotified.length === 0 || uncompletedTasks.length === 0) {
        return;
      }
    }

    if (
      uncompletedTasks.length === 0 &&
      plan.group.cohortType !== ReminderCohortType.GroupLeadsWithUncompleted
    ) {
      return;
    }

    const idempotency_key = `reminder:${plan.group.id}:${plan.user.id}`;

    // Group-leads nudges are about *other* users' tasks, so they don't get
    // the event stamp or covered-task record and never count toward
    // excludePreviouslyNotified.
    const personal = cohortNotifiesRecipientPersonally(plan.group.cohortType);
    // Record only tasks within the group's own scope: without the suite task
    // count, `uncompletedTasks` spans every suite the user participates in,
    // and recording those extra ids would make a later catch-up on this event
    // treat tasks as already-notified that this message may never have
    // mentioned. Matches the granularity coverage checks consult and the
    // migration backfill.
    const scopeActionIds = new Set(groupTaskScopeActionIds(plan.group));
    const plannedNotif = this.actionEventNotifsRepository.create({
      user: plan.user,
      reminderGroup: plan.group,
      memberActionEvent: personal ? plan.group.memberActionEvent : undefined,
      notifiedActionIds: personal
        ? uncompletedTasks
            .filter((task) => scopeActionIds.has(task.id))
            .map((task) => task.id)
        : null,
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
    if (userActionNotifsEnabled_push(plan.user)) {
      sendingAnyNotif = true;
      const pushMessage = await this.processCustomReminderText(
        plan.group.pushMessage,
        plan,
        cid,
        uncompletedTasks,
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
    if (userActionNotifsEnabled_text(plan.user)) {
      sendingAnyNotif = true;
      const textMessage = await this.processCustomReminderText(
        plan.group.textMessage,
        plan,
        cid,
        uncompletedTasks,
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
    if (userActionNotifsEnabled_email(plan.user)) {
      sendingAnyNotif = true;

      const emailMessage = await this.processCustomReminderText(
        plan.group.emailMessage,
        plan,
        cid,
        uncompletedTasks,
      );
      const emailSubject = await this.processCustomReminderText(
        plan.group.emailSubject,
        plan,
        cid,
        uncompletedTasks,
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
