import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { millisecondsInWeek } from "date-fns/constants";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "src/actions/entities/action.entity";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import { findStartedMemberActionEvent } from "src/utils/action-user";
import { yieldToEventLoop } from "src/utils/event-loop";
import { In, type Repository } from "typeorm";
import { PlatformTenureCohortStats } from "./platform-tenure-cohort.dto";

@Injectable()
export class PlatformTenureAnalyticsService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
  ) {}

  async getPlatformTenureCohortStats(
    weeksOnPlatform: number,
  ): Promise<PlatformTenureCohortStats> {
    const normalizedWeeks = Math.max(0, Math.floor(weeksOnPlatform));
    const now = new Date();

    // Cohort membership needs a first SIGNED contract event, which partial
    // profiles can't have, so the active-user set covers everyone relevant —
    // and the session shares this load with findBaseUsersForEvents below.
    const session = new CohortResolutionSession();
    const users =
      await this.actionEventRecipientService.getActiveUsers(session);

    const cohortUserIds = new Set<number>();
    let activeCount = 0;

    for (const user of users) {
      const signedAt = (user.contractEvents ?? [])
        .filter((event) => event.type === ContractEventType.SIGNED)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date;

      if (!signedAt) {
        continue;
      }

      const tenureWeeks = Math.floor(
        (now.getTime() - signedAt.getTime()) / millisecondsInWeek,
      );
      if (tenureWeeks === normalizedWeeks) {
        cohortUserIds.add(user.id);
        if (user.hasActiveContract) {
          activeCount += 1;
        }
      }
    }

    if (cohortUserIds.size === 0) {
      return {
        weeksOnPlatform: normalizedWeeks,
        cohortSize: 0,
        activeCount: 0,
        churnedCount: 0,
        churnRate: 0,
        assignedCount: 0,
        completedCount: 0,
        completionRate: 0,
        actions: [],
      };
    }

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        userId: In(Array.from(cohortUserIds)),
        type: ActionActivityType.USER_COMPLETED,
      },
      select: { userId: true, actionId: true },
    });

    const completedLookup = new Set<string>();
    for (const activity of completionActivities) {
      completedLookup.add(`${activity.userId}:${activity.actionId}`);
    }

    const actions = await this.actionRepository
      .find({
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));

    const actionStats: PlatformTenureCohortStats["actions"] = [];

    const eligible: {
      action: ParsedAction;
      memberActionEvent: ActionEvent;
      memberActionEndEvent: ActionEvent | undefined;
    }[] = [];
    for (const action of actions) {
      if (action.publicOnly || action.onboarding || action.optional) {
        continue;
      }

      const sortedEvents = (action.events ?? []).sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const memberActionEvent = findStartedMemberActionEvent(sortedEvents, now);

      if (!memberActionEvent) {
        continue;
      }

      const memberActionEndEvent =
        action.memberActionPhase.deadlineEvent ?? undefined;

      eligible.push({ action, memberActionEvent, memberActionEndEvent });
    }

    const baseUsersByAction =
      await this.actionEventRecipientService.findBaseUsersForEvents({
        entries: eligible.map((e) => ({
          action: e.action,
          eventId: e.memberActionEvent.id,
        })),
        includeSuspended: true,
        session,
      });

    for (const {
      action,
      memberActionEvent,
      memberActionEndEvent,
    } of eligible) {
      // Long CPU-bound accumulation; let queued requests run between actions.
      await yieldToEventLoop();
      const baseUsers = baseUsersByAction.get(action.id) ?? [];

      const assignedCohortUsers = baseUsers.filter(
        (user) =>
          cohortUserIds.has(user.id) &&
          user.hasActiveContractAt(memberActionEvent.date),
      );
      if (assignedCohortUsers.length === 0) {
        continue;
      }

      const completedCount = assignedCohortUsers.filter((user) =>
        completedLookup.has(`${user.id}:${action.id}`),
      ).length;

      actionStats.push({
        actionId: action.id,
        actionName: action.name,
        assignedCount: assignedCohortUsers.length,
        completedCount,
        completionRate: completedCount / assignedCohortUsers.length,
        memberActionStartDate: memberActionEvent.date,
        memberActionEndDate: memberActionEndEvent?.date,
      });
    }

    actionStats.sort(
      (a, b) =>
        b.assignedCount - a.assignedCount ||
        a.memberActionStartDate.getTime() - b.memberActionStartDate.getTime(),
    );

    const assignedCount = actionStats.reduce(
      (sum, action) => sum + action.assignedCount,
      0,
    );
    const completedCount = actionStats.reduce(
      (sum, action) => sum + action.completedCount,
      0,
    );
    const churnedCount = cohortUserIds.size - activeCount;

    return {
      weeksOnPlatform: normalizedWeeks,
      cohortSize: cohortUserIds.size,
      activeCount,
      churnedCount,
      churnRate: churnedCount / cohortUserIds.size,
      assignedCount,
      completedCount,
      completionRate: assignedCount > 0 ? completedCount / assignedCount : 0,
      actions: actionStats,
    };
  }
}
