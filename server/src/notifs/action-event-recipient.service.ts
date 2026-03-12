import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import {
  ActionActivity,
  ActionActivityType,
} from '../actions/entities/action-activity.entity';
import { Action } from '../actions/entities/action.entity';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { ActionEventNotifType } from './entities/action-event-notif.entity';
import {
  ReminderCohortType,
  ReminderGroup,
} from 'src/actions/entities/reminder-group.entity';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import { computeIsAwayInRange } from 'src/utils/user';
import { findLeast } from 'src/utils/filter';
import { CommunityService } from 'src/community/community.service';
import type { CohortExpression } from 'src/actions/cohort-expression.types';
import {
  evaluateCohortExpressionForUser,
  type SingleUserCohortContext,
} from 'src/actions/cohort-expression.evaluator';

@Injectable()
export class ActionEventRecipientService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly communityService: CommunityService,
    private readonly userService: UserService,
  ) {}

  computeShouldParticipate(params: {
    eventDate: Date;
    deadlineDate: Date | null;
    everyoneShouldComplete: boolean;
    cohortExpression?: CohortExpression | null;
    user: User;
    userDismissed: boolean;
    onboarding: boolean;
    includeSuspended?: boolean;
    includeDismissed?: boolean;
  }): boolean {
    const {
      eventDate,
      deadlineDate,
      everyoneShouldComplete,
      cohortExpression,
      user,
      userDismissed,
      onboarding,
      includeSuspended = false,
      includeDismissed = false,
    } = params;

    if (!includeDismissed && userDismissed) {
      return false;
    }

    // Evaluate cohort expression synchronously for simple leaf types
    if (cohortExpression) {
      const inCohort = this.evaluateCohortExpressionSync(
        cohortExpression,
        user,
      );
      if (!inCohort) return false;
    }

    if (
      !everyoneShouldComplete &&
      deadlineDate &&
      !user.hasActiveContractInFullRange({
        startDate: eventDate,
        endDate: deadlineDate,
      })
    ) {
      return false;
    }

    if (onboarding) {
      const earliestContractEvent = findLeast(
        user.contractEvents ?? [],
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      if (earliestContractEvent && earliestContractEvent.date < eventDate) {
        return false;
      }
    }

    if (includeSuspended) {
      return true;
    }
    return user.hasActiveContractAt(eventDate) || everyoneShouldComplete;
  }

  /**
   * Synchronous evaluation of a cohort expression for a single user.
   * Only handles Tag and Manual leaf types synchronously.
   * Other leaf types default to true (permissive) for notification purposes.
   */
  private evaluateCohortExpressionSync(
    expr: CohortExpression,
    user: User,
  ): boolean {
    if ('type' in expr) {
      switch (expr.type) {
        case 'Tag':
          return (user.tags || []).some((tag) => tag.id === expr.tagId);
        case 'Manual':
          return expr.userIds.includes(user.id);
        case 'CompletedAction':
        case 'InProgressAction':
        case 'FormFieldValue':
        case 'GroupLead':
          // Async leaf types: permissive by default in sync context
          return true;
      }
    }

    if ('op' in expr) {
      switch (expr.op) {
        case 'AND':
          return expr.children.every((child) =>
            this.evaluateCohortExpressionSync(child, user),
          );
        case 'OR':
          return expr.children.some((child) =>
            this.evaluateCohortExpressionSync(child, user),
          );
        case 'NOT':
          return !this.evaluateCohortExpressionSync(expr.child, user);
      }
    }

    return true;
  }

  getNextEvent(params: {
    events: ActionEvent[];
    currentEventId: number;
  }): ActionEvent | null {
    const { events, currentEventId } = params;
    const sortedEvents = events.toSorted(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const currentEventIndex = sortedEvents.findIndex(
      (event) => event.id === currentEventId,
    );
    if (currentEventIndex === -1) {
      return null;
    }
    return sortedEvents[currentEventIndex + 1] ?? null;
  }

  public async findBaseUsersForEvent(params: {
    eventStatus: ActionStatus;
    action: Action;
    eventId: number;
    includeSuspended?: boolean;
    includeDismissed?: boolean;
  }): Promise<User[]> {
    const { eventStatus, action, eventId, includeSuspended, includeDismissed } =
      params;
    const events =
      action.events ??
      (
        await this.actionRepository.findOneOrFail({
          where: { id: action.id },
          relations: { events: true },
        })
      ).events;

    const event = events.find((event) => event.id === eventId);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const deadlineEvent = this.getNextEvent({
      events,
      currentEventId: eventId,
    });

    const usersDismissed = new Set(
      (
        await this.actionActivityRepository.find({
          where: {
            action: { id: action.id },
            type: ActionActivityType.USER_DISMISSED,
          },
        })
      ).map((a) => a.userId),
    );
    const filterToEligible = (user: User) =>
      this.computeShouldParticipate({
        eventDate: event.date,
        deadlineDate: deadlineEvent?.date ?? null,
        everyoneShouldComplete: action.everyoneShouldComplete,
        cohortExpression: action.cohortExpression,
        user,
        userDismissed: usersDismissed.has(user.id),
        onboarding: action.onboarding,
        includeSuspended,
        includeDismissed,
      }) &&
      !computeIsAwayInRange({
        user,
        startDate: event.date,
        endDate: this.getNextEvent({
          events,
          currentEventId: eventId,
        })?.date,
      });

    if (eventStatus === ActionStatus.MemberAction && !action.commitmentless) {
      const activities = await this.actionActivityRepository.find({
        where: {
          actionId: action.id,
          type: ActionActivityType.USER_JOINED,
        },
        relations: {
          user: {
            tags: true,
            awayRanges: true,
            contractEvents: true,
          },
        },
      });
      return activities
        .map((activity) => activity.user)
        .filter(filterToEligible);
    }

    if (
      eventStatus === ActionStatus.GatheringCommitments ||
      eventStatus === ActionStatus.MemberAction
    ) {
      return (await this.userService.findActiveUsersWithTags()).filter(
        filterToEligible,
      );
    }

    return [];
  }

  async filterForShouldRemind(
    users: User[],
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date'>,
    deadlineEvent: Pick<ActionEvent, 'newStatus' | 'action' | 'date'> | null,
    actionSuite?: ActionSuite,
  ): Promise<User[]> {
    const usersWithTags = await this.userService.findByIds(
      users.map((user) => user.id),
      { tags: true, awayRanges: true, contractEvents: true },
    );
    const idToUser = new Map(usersWithTags.map((user) => [user.id, user]));

    const usersDismissed = new Set(
      (
        await this.actionActivityRepository.find({
          where: {
            action: { id: event.action.id },
            type: ActionActivityType.USER_DISMISSED,
          },
        })
      ).map((a) => a.userId),
    );
    const filterToEligible = (user: User) =>
      this.computeShouldParticipate({
        eventDate: event.date,
        deadlineDate: deadlineEvent?.date ?? null,
        everyoneShouldComplete: event.action.everyoneShouldComplete,
        cohortExpression: event.action.cohortExpression,
        user: idToUser.get(user.id)!,
        userDismissed: usersDismissed.has(user.id),
        onboarding: event.action.onboarding,
      });

    const actions = actionSuite ? actionSuite.actions : [event.action];

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        userId: In(users.map((user) => user.id)),
        actionId: In(actions.map((action) => action.id)),
        type: In([
          ActionActivityType.USER_COMPLETED,
          ActionActivityType.USER_DECLINED,
          ActionActivityType.USER_WONT_COMPLETE,
        ]),
      },
    });

    const userToHasCompletedAllActions = new Map<number, boolean>();
    for (const user of users) {
      userToHasCompletedAllActions.set(
        user.id,
        actions.every((action) =>
          completionActivities.some(
            (activity) =>
              activity.userId === user.id && activity.actionId === action.id,
          ),
        ),
      );
    }

    return users
      .filter(filterToEligible)
      .filter((user) => !userToHasCompletedAllActions.get(user.id));
  }

  async findFilteredGroupLeads(
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date' | 'id'>,
    deadlineEvent: Pick<ActionEvent, 'newStatus' | 'action' | 'date'> | null,
    type: ActionEventNotifType,
    suite?: ActionSuite,
  ): Promise<User[]> {
    const uncompleted = (
      await this.findFilteredUsersForEvent(
        event,
        deadlineEvent,
        ActionEventNotifType.PersonalReminder,
        suite,
      )
    ).map((user) => user.id);

    const leaders =
      await this.communityService.findLeadersOfCommunitiesWithUsers(
        uncompleted,
      );

    return leaders.filter(
      (leader) => leader.remindAboutUncompletedGroupMembers,
    );
  }

  async findFilteredUsersForEvent(
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date' | 'id'>,
    deadlineEvent: Pick<ActionEvent, 'newStatus' | 'action' | 'date'> | null,
    type: ActionEventNotifType,
    suite?: ActionSuite,
  ): Promise<User[]> {
    const users = await this.findBaseUsersForEvent({
      action: event.action,
      eventId: event.id,
      eventStatus: event.newStatus,
    });
    return type === ActionEventNotifType.Announcement
      ? users
      : await this.filterForShouldRemind(users, event, deadlineEvent, suite);
  }

  async findReminderGroupCohort(group: ReminderGroup): Promise<User[]> {
    let users: User[];
    switch (group.cohortType) {
      case ReminderCohortType.Custom:
        if (!group.users) {
          throw new Error('Custom cohort type requires users');
        }
        users = group.users;
        break;
      case ReminderCohortType.AllUncompleted:
        users = await this.findFilteredUsersForEvent(
          group.memberActionEvent,
          group.deadlineEvent ?? null,
          ActionEventNotifType.PersonalReminder,
          group.actionSuite,
        );
        break;
      case ReminderCohortType.GroupLeadsWithUncompleted:
        return await this.findFilteredGroupLeads(
          group.memberActionEvent,
          group.deadlineEvent ?? null,
          ActionEventNotifType.PersonalReminder,
          group.actionSuite,
        );
      case ReminderCohortType.Tag:
        if (!group.userTag) {
          throw new Error('Group cohort type requires user tag');
        }
        const userTag = await this.userService.findTagOrFail(group.userTag.id);
        users = userTag.users;
        break;
      default:
        throw new Error(
          `Invalid cohort type: ${group.cohortType satisfies never}`,
        );
    }
    return this.filterForShouldRemind(
      users,
      group.memberActionEvent,
      group.deadlineEvent ?? null,
      group.actionSuite,
    );
  }
}
