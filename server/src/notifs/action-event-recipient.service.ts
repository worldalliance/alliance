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
  evaluateCohortExpression,
  type CohortEvaluationContext,
} from 'src/actions/cohort-expression.evaluator';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { Community } from 'src/community/entities/community.entity';
import { Tag } from 'src/user/entities/tag.entity';

@Injectable()
export class ActionEventRecipientService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly communityService: CommunityService,
    private readonly userService: UserService,
  ) {}

  /**
   * Resolve a cohort expression to a set of matching user IDs using batch
   * set-based queries (one query per leaf type, not per user).
   */
  async resolveCohortMemberIds(
    expression: CohortExpression | null | undefined,
  ): Promise<Set<number> | null> {
    if (!expression) return null;
    const ctx: CohortEvaluationContext = {
      getUserIdsForTag: async (tagId: string) => {
        if (!tagId) return new Set();
        const tag = await this.tagRepository.findOne({
          where: { id: tagId },
          relations: { users: true },
        });
        return new Set((tag?.users ?? []).map((u) => u.id));
      },
      getUserIdsCompletedAction: async (actionId: number) => {
        if (!actionId) return new Set();
        const activities = await this.actionActivityRepository.find({
          where: { actionId, type: ActionActivityType.USER_COMPLETED },
        });
        return new Set(activities.map((a) => a.userId));
      },
      getUserIdsInProgressAction: async (actionId: number) => {
        if (!actionId) return new Set();
        const joined = await this.actionActivityRepository.find({
          where: { actionId, type: ActionActivityType.USER_JOINED },
        });
        const terminal = await this.actionActivityRepository.find({
          where: [
            { actionId, type: ActionActivityType.USER_COMPLETED },
            { actionId, type: ActionActivityType.USER_WONT_COMPLETE },
          ],
        });
        const terminalIds = new Set(terminal.map((a) => a.userId));
        return new Set(
          joined.map((a) => a.userId).filter((id) => !terminalIds.has(id)),
        );
      },
      getUserIdsForFormField: async (params) => {
        if (!params.formId) return new Set();
        const responses = await this.formResponseRepository.find({
          where: { formId: params.formId },
          relations: { user: true },
        });
        const matching = responses.filter((r) => {
          if (params.responseEqualTo !== undefined && !params.responseAny) {
            return (
              String(
                (r.answers as Record<string, unknown>)?.[params.fieldId],
              ) === params.responseEqualTo
            );
          }
          return (
            (r.answers as Record<string, unknown>)?.[params.fieldId] !==
            undefined
          );
        });
        return new Set(
          matching
            .map((r) => r.user?.id)
            .filter((id): id is number => typeof id === 'number'),
        );
      },
      getGroupLeadUserIds: async () => {
        const communities = await this.communityRepository.find({
          relations: { leaders: true },
        });
        const ids = new Set<number>();
        for (const c of communities) {
          for (const leader of c.leaders ?? []) {
            ids.add(leader.id);
          }
        }
        return ids;
      },
      getAllCandidateUserIds: async () => {
        const users = await this.userService.findActiveUsersWithTags();
        return new Set(users.map((u) => u.id));
      },
    };
    return evaluateCohortExpression(expression, ctx);
  }

  computeShouldParticipate(params: {
    eventDate: Date;
    deadlineDate: Date | null;
    everyoneShouldComplete: boolean;
    cohortMemberIds: Set<number> | null;
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
      cohortMemberIds,
      user,
      userDismissed,
      onboarding,
      includeSuspended = false,
      includeDismissed = false,
    } = params;

    if (!includeDismissed && userDismissed) {
      return false;
    }

    if (cohortMemberIds && !cohortMemberIds.has(user.id)) {
      return false;
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

    const [usersDismissed, cohortMemberIds] = await Promise.all([
      this.actionActivityRepository
        .find({
          where: {
            action: { id: action.id },
            type: ActionActivityType.USER_DISMISSED,
          },
        })
        .then((acts) => new Set(acts.map((a) => a.userId))),
      this.resolveCohortMemberIds(action.cohortExpression),
    ]);

    const filterToEligible = (user: User) =>
      this.computeShouldParticipate({
        eventDate: event.date,
        deadlineDate: deadlineEvent?.date ?? null,
        everyoneShouldComplete: action.everyoneShouldComplete,
        cohortMemberIds,
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
      return activities.map((a) => a.user).filter(filterToEligible);
    }

    if (
      eventStatus === ActionStatus.GatheringCommitments ||
      eventStatus === ActionStatus.MemberAction
    ) {
      const users = await this.userService.findActiveUsersWithTags();
      return users.filter(filterToEligible);
    }

    return [];
  }

  async filterForShouldRemind(
    users: User[],
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date'>,
    deadlineEvent: Pick<ActionEvent, 'newStatus' | 'action' | 'date'> | null,
    actionSuite?: ActionSuite,
  ): Promise<User[]> {
    const actions = actionSuite ? actionSuite.actions : [event.action];

    const [
      usersWithTags,
      usersDismissed,
      cohortMemberIds,
      completionActivities,
    ] = await Promise.all([
      this.userService.findByIds(
        users.map((user) => user.id),
        { tags: true, awayRanges: true, contractEvents: true },
      ),
      this.actionActivityRepository
        .find({
          where: {
            action: { id: event.action.id },
            type: ActionActivityType.USER_DISMISSED,
          },
        })
        .then((acts) => new Set(acts.map((a) => a.userId))),
      this.resolveCohortMemberIds(event.action.cohortExpression),
      this.actionActivityRepository.find({
        where: {
          userId: In(users.map((user) => user.id)),
          actionId: In(actions.map((action) => action.id)),
          type: In([
            ActionActivityType.USER_COMPLETED,
            ActionActivityType.USER_DECLINED,
            ActionActivityType.USER_WONT_COMPLETE,
          ]),
        },
      }),
    ]);

    const idToUser = new Map(usersWithTags.map((user) => [user.id, user]));

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
      .filter((user) =>
        this.computeShouldParticipate({
          eventDate: event.date,
          deadlineDate: deadlineEvent?.date ?? null,
          everyoneShouldComplete: event.action.everyoneShouldComplete,
          cohortMemberIds,
          user: idToUser.get(user.id)!,
          userDismissed: usersDismissed.has(user.id),
          onboarding: event.action.onboarding,
        }),
      )
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
