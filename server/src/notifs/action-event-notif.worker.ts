// action-event-notif.worker.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionsService } from "src/actions/actions.service";
import type { ActionSuite } from "src/actions/entities/action-suite.entity";
import {
  cohortNotifiesRecipientPersonally,
  ReminderCohortType,
} from "src/actions/entities/reminder-group.entity";
import { type MissedSuiteStanding } from "src/actions/missed-suite-streak";
import {
  NOTIF_SOURCE,
  reminderContext,
} from "src/link-tracking/message-tracking.entity";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { EmailStatus } from "src/mail/mail.entity";
import { MailService, processKeywordReplacements } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { PushService } from "src/push/push.service";
import { tasksUrl } from "src/search/approutes";
import type { User } from "src/user/entities/user.entity";
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
import { isUniqueViolation } from "src/utils/db-errors";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import { DataSource, QueryFailedError, type Repository } from "typeorm";
import {
  ActionEventReminderService,
  groupTaskScopeActionIds,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  tasksNotYetNotified,
} from "./action-event-reminder.service";
import { NotificationPlan } from "./dto/notification-plan.dto";
import {
  ActionEventNotif,
  ActionEventNotifType,
  MissedSuiteNoticeCopy,
} from "./entities/action-event-notif.entity";
import {
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "./entities/experiment-assignment.entity";
import {
  NotificationCategory,
  type Notification,
} from "./entities/notification.entity";
import { assignExperimentArms } from "./experiment-assignment";
import { LOCK_KEYS } from "./lock-keys";
import { withPgAdvisoryLock } from "./lock-utils";
import {
  FIRST_MISS_COPY,
  getsMissedSuiteNotice,
  missedSuiteNoticeKey,
  missedSuiteNoticeTemplates,
  MissedSuitePlanKind,
  resolveMissedSuitePlan,
  type ChannelTemplates,
} from "./missed-suite-notice";
import { MissedSuitePlanService } from "./missed-suite-plans.service";
import { NotifsService } from "./notifs.service";
import { buildReminderMessage } from "./reminder-message";
import { saveForLiveRecipient } from "./save-for-live-recipient";

export type UncompletedTaskSummary = {
  id: number;
  name: string;
  timeEstimate?: number;
};

const reminderTracking = (
  plan: NotificationPlan,
  notif: ActionEventNotif,
): TrackedMessage => ({
  owner: { userId: plan.user.id },
  source: NOTIF_SOURCE[notif.type],
  context: reminderContext({
    group: plan.group,
    action: plan.group.memberActionEvent.action,
    notifiedActionIds: notif.notifiedActionIds,
    actionSuiteId: notif.actionSuite?.id ?? null,
    missNumber: notif.missNumber,
    missedSuiteCopy: notif.missedSuiteCopy,
  }),
  actionEventNotifId: notif.id,
});

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
    private readonly missedSuitePlans: MissedSuitePlanService,
    private readonly pushService: PushService,
    private readonly notifsService: NotifsService,
    @InjectRepository(ExperimentAssignment)
    private readonly experimentAssignmentRepository: Repository<ExperimentAssignment>,
  ) {}

  @Cron("*/3 * * * *")
  async dispatchDueNotifs() {
    if (!notifDeliveryEnabled()) {
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

        const duePlans = await this.missedSuitePlans.dropClaimedPlans(
          await this.reminderService.evaluateNotifications(windowStart, now),
        );
        const closedSuites = await this.missedSuitePlans.findClosedSuitesFor(
          duePlans,
          now,
        );
        const skippedByGroup = new Map<
          number,
          { problem: string; count: number }
        >();
        const skip = (plan: NotificationPlan, problem: string) =>
          skippedByGroup.set(plan.group.id, {
            problem,
            count: (skippedByGroup.get(plan.group.id)?.count ?? 0) + 1,
          });
        for (const plan of duePlans) {
          const resolution = resolveMissedSuitePlan({
            group: plan.group,
            userId: plan.user.id,
            closedSuites,
          });
          switch (resolution.kind) {
            case MissedSuitePlanKind.Ordinary:
              await this.processOne(plan);
              break;
            case MissedSuitePlanKind.NoSuite:
              skip(plan, "has no suite");
              break;
            case MissedSuitePlanKind.SuiteOpen:
              skip(
                plan,
                `suite ${resolution.suite.id} has not closed: a required action has a later deadline than this group, or none`,
              );
              break;
            case MissedSuitePlanKind.Due:
              await this.processMissedSuite(
                plan,
                resolution.suite,
                resolution.standing,
              );
              break;
            default:
              throw new Error(
                `unknown missed-suite plan kind: ${resolution satisfies never}`,
              );
          }
        }
        for (const [groupId, { problem, count }] of skippedByGroup) {
          this.logger.error(
            `missed-suite reminder group ${groupId} ${problem}; skipped ${count} member(s)`,
          );
        }
      },
    );

    if (ran === null) {
      this.logger.log("processOne skipped bc of lock");
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
    uncompletedTasks: UncompletedTaskSummary[],
    missedSuiteStanding?: MissedSuiteStanding,
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
      uncompletedTasksCount: uncompletedTasks.length,
      uncompletedMembersInGroupCount,
      uncompletedTasksNames: uncompletedTasks.map((task) => task.name),
      uncompletedTasksTime:
        uncompletedTasks.reduce(
          (acc, task) => acc + (task.timeEstimate ?? 0),
          0,
        ) + " minutes",
      isFirstAssignedSuite: missedSuiteStanding?.isFirstAssignedSuite,
    });
  }

  private async processOne(plan: NotificationPlan) {
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

    let notif: ActionEventNotif | null;
    try {
      notif = await saveForLiveRecipient(this.dataSource, {
        plan,
        notif: plannedNotif,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        this.logger.error(`skipping duplicate notif: ${error.message}`);
        return;
      }
      throw error;
    }
    if (!notif) return;

    const sendingAnyNotif = await this.deliver({
      notif,
      user: plan.user,
      tracking: reminderTracking(plan, notif),
      templates: plan.group,
      render: (template) =>
        this.processCustomReminderText(template, plan, uncompletedTasks),
      push: { screen: "/", idempotencyKey: plan.group.id.toString() },
    });
    if (sendingAnyNotif) {
      await this.actionEventNotifsRepository.save(notif);
    }
  }

  /**
   * One notice per member and suite whatever the number of groups, actions,
   * or reruns: the idempotency key claims the suite before anything is sent.
   * A third consecutive miss sends nothing here; the suspension notice
   * replaces it. A member sent nothing still claims the key, unsent, so
   * sibling groups drop them.
   */
  private async processMissedSuite(
    plan: NotificationPlan,
    suite: ActionSuite,
    standing: MissedSuiteStanding | null,
  ) {
    const suiteId = suite.id;
    const notice = getsMissedSuiteNotice(standing)
      ? {
          standing,
          copy:
            standing.missNumber === 1
              ? FIRST_MISS_COPY[await this.assignFirstMissArm(plan.user.id)]
              : MissedSuiteNoticeCopy.SecondMissReportV1,
        }
      : null;

    let notif: ActionEventNotif | null;
    try {
      notif = await saveForLiveRecipient(this.dataSource, {
        plan,
        notif: this.actionEventNotifsRepository.create({
          user: plan.user,
          reminderGroup: plan.group,
          memberActionEvent: cohortNotifiesRecipientPersonally(
            plan.group.cohortType,
          )
            ? plan.group.memberActionEvent
            : undefined,
          notifiedActionIds:
            notice?.standing.missedActions.map((action) => action.id) ?? [],
          sent: false,
          type: ActionEventNotifType.MissedDeadline,
          idempotency_key: missedSuiteNoticeKey(suiteId, plan.user.id),
          actionSuite: suite,
          missNumber: standing?.missNumber ?? null,
          missedSuiteCopy: notice?.copy ?? null,
        } satisfies Partial<ActionEventNotif>),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(`skipping duplicate missed-suite notice`);
        return;
      }
      throw error;
    }
    if (!notif || !notice) return;

    const templates = missedSuiteNoticeTemplates(notice.copy, plan.group);
    const render = (template: string) =>
      this.processCustomReminderText(
        template,
        plan,
        notice.standing.missedActions,
        notice.standing,
      );

    const inAppMessage = await buildReminderMessage({
      template: templates.pushMessage,
      renderText: render,
      recipient: plan.user,
      action: plan.group.memberActionEvent.action,
      tasks: notice.standing.missedActions,
    });
    if (inAppMessage.text.trim()) {
      notif.notification = await this.notifsService.sendNotif({
        user: plan.user,
        category: NotificationCategory.ActionEvent,
        message: inAppMessage,
        destination: null,
        webAppLocation: tasksUrl(),
        mobileAppLocation: tasksUrl(),
        associatedUsers: [],
        shouldPush: false,
      });
      notif.sent = true;
    } else {
      this.logger.error(
        `missed-suite reminder group ${plan.group.id} has blank push copy; skipped its in-app entry`,
      );
    }
    // An opening of the text reads this entry through notificationId, even
    // when a later send fails.
    if (notif.notification) await this.actionEventNotifsRepository.save(notif);
    await this.deliver({
      notif,
      user: plan.user,
      tracking: reminderTracking(plan, notif),
      templates,
      render,
      push: {
        screen: "/",
        idempotencyKey: `missed-suite-${suiteId}`,
        notification: notif.notification,
      },
    });
    await this.actionEventNotifsRepository.save(notif);
  }

  private async assignFirstMissArm(userId: number): Promise<ExperimentArm> {
    const arm = (
      await assignExperimentArms(this.experimentAssignmentRepository.manager, {
        experiment: Experiment.MissedSuiteFirstNotice,
        userIds: [userId],
      })
    ).get(userId);
    if (arm === undefined) {
      throw new Error(`no first-miss arm for user ${userId}`);
    }
    return arm;
  }

  /** Sends on each channel the member enabled; true if any was attempted. */
  private async deliver(params: {
    notif: ActionEventNotif;
    user: User;
    tracking: TrackedMessage;
    templates: ChannelTemplates;
    render: (template: string) => Promise<string>;
    push: {
      screen: string;
      idempotencyKey: string;
      notification?: Notification;
    };
  }): Promise<boolean> {
    const { notif, user, tracking, templates, render, push } = params;
    let sendingAnyNotif = false;
    if (userActionNotifsEnabled_push(user)) {
      sendingAnyNotif = true;
      const pushes = await this.pushService.getPushForAllUserDevices(user.id, {
        userId: user.id,
        body: await render(templates.pushMessage),
        screen: push.screen,
        idempotencyKey: push.idempotencyKey,
        notification: push.notification,
      });

      const result = await this.pushService.sendMessages(pushes);
      notif.pushes = result;
      if (result.length > 0) {
        notif.sent = true;
      }
    }
    if (userActionNotifsEnabled_text(user)) {
      sendingAnyNotif = true;
      const result = await this.mmsService.sendMms({
        to: user.phoneNumber!,
        body: await render(templates.textMessage),
        mediaUrls: [],
        tracking,
      });

      if (result && !result.errorCode) {
        notif.sent = true;
      }
      notif.mms = result;
    }
    if (userActionNotifsEnabled_email(user)) {
      sendingAnyNotif = true;
      const result = await this.mailService.sendActionEventNotificationEmail({
        subject: await render(templates.emailSubject),
        message: await render(templates.emailMessage),
        tracking,
        recipient: user.email,
      });
      notif.mail = result;
      if (result.status === EmailStatus.Sent) {
        notif.sent = true;
      }
    }
    return sendingAnyNotif;
  }
}
