// action-event-notif.worker.ts
import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { loadedActionEventAction } from "src/actions/entities/action-event.entity";
import type { ActionSuite } from "src/actions/entities/action-suite.entity";
import {
  cohortNotifiesRecipientPersonally,
  loadedReminderGroupMemberActionEvent,
  ReminderCohortType,
} from "src/actions/entities/reminder-group.entity";
import { MemberActionsService } from "src/actions/member-actions.service";
import { type MissedSuiteStanding } from "src/actions/missed-suite-streak";
import { updateLive } from "src/datasources/soft-delete";
import { assertLeaseHeld, CronLease } from "src/leases/cron-lease";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { processKeywordReplacements } from "src/notifs/notification-keywords";
import { tasksUrl } from "src/search/approutes";
import { isUniqueViolation } from "src/utils/db-errors";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import {
  DataSource,
  type EntityManager,
  QueryFailedError,
  type Repository,
} from "typeorm";
import {
  ActionEventNotifDeliveryService,
  reminderTracking,
} from "./action-event-notif-delivery.service";
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
  ExperimentAssignment,
} from "./entities/experiment-assignment.entity";
import { NotificationCategory } from "./entities/notification.entity";
import { assignExperimentArm } from "./experiment-assignment";
import {
  FIRST_MISS_COPY,
  getsMissedSuiteNotice,
  missedSuiteNoticeKey,
  missedSuiteNoticeTemplates,
  MissedSuitePlanKind,
  resolveMissedSuitePlan,
} from "./missed-suite-notice";
import { MissedSuitePlanService } from "./missed-suite-plans.service";
import { NotifsService } from "./notifs.service";
import { recordDelivery } from "./record-delivery";
import { reminderGroupKind } from "./reminder-group-kind";
import { buildReminderMessage } from "./reminder-message";
import {
  assignSocialProofArm,
  socialProofDelivery,
} from "./reminder-social-proof";
import {
  lockReminderCoverage,
  saveForLiveRecipient,
} from "./save-for-live-recipient";

export type UncompletedTaskSummary = {
  id: number;
  name: string;
  timeEstimate: number | null;
};

@Injectable()
export class ActionEventNotifWorker {
  private readonly logger = new Logger(ActionEventNotifWorker.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly memberActions: MemberActionsService,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    private readonly reminderService: ActionEventReminderService,
    private readonly missedSuitePlans: MissedSuitePlanService,
    private readonly delivery: ActionEventNotifDeliveryService,
    private readonly notifsService: NotifsService,
    private readonly preferences: NotificationPreferencesService,
    @InjectRepository(ExperimentAssignment)
    private readonly experimentAssignmentRepository: Repository<ExperimentAssignment>,
  ) {}

  @Cron("*/3 * * * *")
  @WithoutOverlapping({ key: CronLease.ActionEventNotifs })
  async dispatchDueNotifs() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    await this.dispatchDue();
  }

  /** Skips the lease and the delivery gate; production runs it through dispatchDueNotifs. */
  async dispatchDue() {
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
      assertLeaseHeld();
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
  }

  async findUncompletedTasksForPlan(
    plan: NotificationPlan,
  ): Promise<UncompletedTaskSummary[]> {
    const tasks = await this.memberActions.findUncompletedTasks(
      plan.user.id,
      plan.group.useSuiteTaskCount ? plan.group.actionSuite?.id : undefined,
    );
    if (plan.group.excludeOptionalActions) {
      // The member's own optionality: a split group's row can make a task
      // optional for them alone.
      return tasks.filter((task) => !(task.viewer?.optional ?? task.optional));
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
      action: loadedActionEventAction(
        loadedReminderGroupMemberActionEvent(plan.group),
      ),
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
    const allUncompletedTasks = await this.findUncompletedTasksForPlan(plan);
    const memberActionEvent = loadedReminderGroupMemberActionEvent(plan.group);
    // Re-derived at send time (not plan time) so a sibling group's send
    // earlier in this same dispatch cycle, or in an overlapping run, counts
    // too. The user is skipped when their prior notifs already cover the
    // group's whole task scope, and otherwise the message only enumerates the
    // tasks they haven't been notified about.
    const notYetNotified = async (manager: EntityManager) => {
      if (!plan.group.excludePreviouslyNotified) return allUncompletedTasks;
      const coverage = await this.reminderService.findNotifCoverage(manager, {
        userId: plan.user.id,
        eventId: memberActionEvent.id,
      });
      const scopeNotYetNotified = tasksNotYetNotified(
        groupTaskScopeActionIds(plan.group).map((id) => ({ id })),
        coverage,
      );
      return scopeNotYetNotified.length === 0
        ? []
        : tasksNotYetNotified(allUncompletedTasks, coverage);
    };
    let uncompletedTasks = await notYetNotified(this.dataSource.manager);

    if (
      uncompletedTasks.length === 0 &&
      (plan.group.excludePreviouslyNotified ||
        plan.group.cohortType !== ReminderCohortType.GroupLeadsWithUncompleted)
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
    const channels = await this.preferences.channelsFor(
      plan.user,
      reminderGroupKind(plan.group),
    );
    const arm = await assignSocialProofArm(this.dataSource.manager, {
      group: plan.group,
      user: plan.user,
      channels,
    });

    let notif: ActionEventNotif | null;
    try {
      notif = await saveForLiveRecipient(this.dataSource, {
        plan,
        actionSuite: null,
        build: async (manager) => {
          if (personal) {
            await lockReminderCoverage(manager, {
              userId: plan.user.id,
              memberActionEventId: memberActionEvent.id,
            });
          }
          if (plan.group.excludePreviouslyNotified) {
            uncompletedTasks = await notYetNotified(manager);
            if (uncompletedTasks.length === 0) return null;
          }
          return this.actionEventNotifsRepository.create({
            user: plan.user,
            reminderGroup: plan.group,
            memberActionEvent: personal ? memberActionEvent : undefined,
            notifiedActionIds: personal
              ? uncompletedTasks
                  .filter((task) => scopeActionIds.has(task.id))
                  .map((task) => task.id)
              : null,
            sent: false,
            deliveryPending: true,
            type: ActionEventNotifType.Reminder,
            idempotency_key,
          } satisfies Partial<ActionEventNotif>);
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log("skipping duplicate notif");
        return;
      }
      if (error instanceof QueryFailedError) {
        this.logger.error(
          `skipping notif that failed to save: ${error.message}`,
        );
        return;
      }
      throw error;
    }
    if (!notif) return;

    let send: () => Promise<boolean>;
    try {
      const socialProof = await socialProofDelivery(this.dataSource.manager, {
        arm,
        plan,
        actionIds: uncompletedTasks.map((task) => task.id),
        render: (text) =>
          this.processCustomReminderText(text, plan, uncompletedTasks),
      });
      Object.assign(notif, socialProof.columns);
      send = await this.delivery.prepare({
        notif,
        user: plan.user,
        channels,
        tracking: reminderTracking(plan, notif),
        templates: socialProof.templates,
        render: socialProof.render,
        push: { screen: "/", idempotencyKey: plan.group.id.toString() },
      });
    } catch (error) {
      await this.releaseReservation(notif.id);
      throw error;
    }
    if (await send()) {
      await recordDelivery(this.dataSource.manager, notif);
    } else {
      await this.releaseReservation(notif.id);
    }
  }

  private async releaseReservation(id: number) {
    await updateLive(this.dataSource.manager, {
      target: ActionEventNotif,
      id,
      changes: { deliveryPending: false },
    });
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
              ? FIRST_MISS_COPY[
                  await assignExperimentArm(
                    this.experimentAssignmentRepository.manager,
                    {
                      experiment: Experiment.MissedSuiteFirstNotice,
                      userId: plan.user.id,
                    },
                  )
                ]
              : MissedSuiteNoticeCopy.SecondMissReportV1,
        }
      : null;

    const memberActionEvent = loadedReminderGroupMemberActionEvent(plan.group);
    const personal = cohortNotifiesRecipientPersonally(plan.group.cohortType);
    let notif: ActionEventNotif | null;
    try {
      notif = await saveForLiveRecipient(this.dataSource, {
        plan,
        actionSuite: suite,
        build: async (manager) => {
          if (personal && notice) {
            await lockReminderCoverage(manager, {
              userId: plan.user.id,
              memberActionEventId: memberActionEvent.id,
            });
          }
          return this.actionEventNotifsRepository.create({
            user: plan.user,
            reminderGroup: plan.group,
            memberActionEvent: personal ? memberActionEvent : undefined,
            notifiedActionIds:
              notice?.standing.missedActions.map((action) => action.id) ?? [],
            sent: false,
            deliveryPending: notice !== null,
            type: ActionEventNotifType.MissedDeadline,
            idempotency_key: missedSuiteNoticeKey(suiteId, plan.user.id),
            missNumber: standing?.missNumber ?? null,
            missedSuiteCopy: notice?.copy ?? null,
          } satisfies Partial<ActionEventNotif>);
        },
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

    let send: () => Promise<boolean>;
    try {
      const inAppMessage = await buildReminderMessage({
        template: templates.pushMessage,
        renderText: render,
        recipient: plan.user,
        action: loadedActionEventAction(memberActionEvent),
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
        notif.sent = notif.notification.visible;
        // An opening of the text reads this entry through notificationId,
        // even when a later send fails.
        await updateLive(this.dataSource.manager, {
          target: ActionEventNotif,
          id: notif.id,
          changes: {
            sent: notif.sent,
            notification: { id: notif.notification.id },
          },
        });
      } else {
        this.logger.error(
          `missed-suite reminder group ${plan.group.id} has blank push copy; skipped its in-app entry`,
        );
      }
      send = await this.delivery.prepare({
        notif,
        user: plan.user,
        channels: await this.preferences.channelsFor(
          plan.user,
          NotificationKind.MissedDeadline,
        ),
        tracking: reminderTracking(plan, notif),
        templates,
        render,
        push: {
          screen: "/",
          idempotencyKey: `missed-suite-${suiteId}`,
          notification: notif.notification,
        },
      });
    } catch (error) {
      if (!notif.sent) await this.releaseReservation(notif.id);
      throw error;
    }
    await send();
    await recordDelivery(this.dataSource.manager, notif);
  }
}
