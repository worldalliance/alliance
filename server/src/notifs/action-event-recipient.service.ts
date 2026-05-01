import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  evaluateCohortExpression,
  type CohortEvaluationContext,
} from 'src/actions/cohort-expression.evaluator';
import type { CohortExpression } from 'src/actions/cohort-expression.types';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import {
  ReminderCohortType,
  ReminderGroup,
} from 'src/actions/entities/reminder-group.entity';
import { CommunityService } from 'src/community/community.service';
import { Community } from 'src/community/entities/community.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { Tag } from 'src/user/entities/tag.entity';
import { computeShouldParticipate } from 'src/utils/action-user';
import { computeIsAwayInRange } from 'src/utils/user';
import { In, type Repository } from 'typeorm';
import {
  ActionActivity,
  ActionActivityType,
} from '../actions/entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { ActionEventNotifType } from './entities/action-event-notif.entity';

@Injectable()
export class ActionEventRecipientService {
  private readonly logger = new Logger(ActionEventRecipientService.name);

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
        const action = await this.actionRepository.findOneOrFail({
          where: { id: actionId },
          relations: { events: true },
        });
        const event = action.events.find(
          (e) => e.newStatus === ActionStatus.MemberAction,
        );
        if (!event) return new Set();
        const baseUsers = await this.findBaseUsersForEvent({
          action,
          eventId: event.id,
        });
        if (action.status !== ActionStatus.MemberAction) return new Set();
        const terminal = await this.actionActivityRepository.find({
          where: [
            { actionId, type: ActionActivityType.USER_COMPLETED },
            { actionId, type: ActionActivityType.USER_WONT_COMPLETE },
          ],
        });
        const terminalIds = new Set(terminal.map((a) => a.userId));
        return new Set(
          baseUsers.map((u) => u.id).filter((id) => !terminalIds.has(id)),
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
          const answer = (r.answers as Record<string, unknown>)?.[
            params.fieldId
          ];
          return !!answer && !(Array.isArray(answer) && answer.length === 0);
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

  /**
   * Batched version of findBaseUsersForEvent: loads shared data once
   * (active users, dismissed activities, cohort expressions) and filters
   * per action. Returns a map from actionId -> eligible users.
   */
  public async findBaseUsersForEvents(params: {
    entries: Array<{ action: Action; eventId: number }>;
    includeSuspended?: boolean;
    includeDismissed?: boolean;
  }): Promise<Map<number, User[]>> {
    const { entries, includeSuspended, includeDismissed } = params;
    if (entries.length === 0) return new Map();

    const actionIds = entries.map((e) => e.action.id);

    // 1. One query: all active users
    const allUsers = await this.userService.findActiveUsersWithTags();

    // 2. One query: all dismissed activities for these actions
    const allDismissed = await this.actionActivityRepository.find({
      where: {
        actionId: In(actionIds),
        type: ActionActivityType.USER_DISMISSED,
      },
    });
    const dismissedByAction = new Map<number, Set<number>>();
    for (const act of allDismissed) {
      if (!dismissedByAction.has(act.actionId)) {
        dismissedByAction.set(act.actionId, new Set());
      }
      dismissedByAction.get(act.actionId)!.add(act.userId);
    }

    // 3. Deduplicated cohort resolution
    const cohortCache = new Map<string, Promise<Set<number> | null>>();
    const cohortByAction = new Map<number, Promise<Set<number> | null>>();
    for (const { action } of entries) {
      const key = action.cohortExpression
        ? JSON.stringify(action.cohortExpression)
        : '';
      if (!cohortCache.has(key)) {
        cohortCache.set(
          key,
          this.resolveCohortMemberIds(action.cohortExpression),
        );
      }
      cohortByAction.set(action.id, cohortCache.get(key)!);
    }
    // Await all unique cohort resolutions in parallel
    await Promise.all(cohortCache.values());

    // 4. Per-action filtering
    const result = new Map<number, User[]>();
    for (const { action, eventId } of entries) {
      const events = action.events;
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        this.logger.warn(
          `Event not found: ${eventId} for action ${action.id}`,
        );
        result.set(action.id, []);
        continue;
      }

      const deadlineEvent = this.getNextEvent({
        events,
        currentEventId: eventId,
      });
      const usersDismissed = dismissedByAction.get(action.id) ?? new Set();
      const cohortMemberIds = await cohortByAction.get(action.id)!;

      const eligible = allUsers.filter(
        (user) =>
          computeShouldParticipate({
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
            endDate: deadlineEvent?.date,
          }),
      );

      result.set(action.id, eligible);
    }

    return result;
  }

  public async findBaseUsersForEvent(params: {
    action: Action;
    eventId: number;
    includeSuspended?: boolean;
    includeDismissed?: boolean;
  }): Promise<User[]> {
    const { action, eventId, includeSuspended, includeDismissed } = params;

    if (!action.events.some((event) => event.id === eventId)) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const result = await this.findBaseUsersForEvents({
      entries: [{ action, eventId }],
      includeSuspended,
      includeDismissed,
    });
    return result.get(action.id) ?? [];
  }

  async filterForShouldRemind(
    users: User[],
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date'>,
    deadlineEvent: Pick<ActionEvent, 'newStatus' | 'action' | 'date'> | null,
    actionSuite?: ActionSuite,
    excludeOptionalActions?: boolean,
  ): Promise<User[]> {
    const pre_actions = actionSuite ? actionSuite.actions : [event.action];
    const actions = excludeOptionalActions
      ? pre_actions.filter((action) => !action.optional)
      : pre_actions;

    const [
      usersWithTags,
      usersDismissed,
      cohortMemberIds,
      perActionCohortMemberIds,
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
      Promise.all(
        actions.map(async (action) => ({
          actionId: action.id,
          memberIds: await this.resolveCohortMemberIds(action.cohortExpression),
        })),
      ),
      this.actionActivityRepository.find({
        where: {
          userId: In(users.map((user) => user.id)),
          actionId: In(actions.map((action) => action.id)),
          type: In([
            ActionActivityType.USER_COMPLETED,
            ActionActivityType.USER_WONT_COMPLETE,
          ]),
        },
      }),
    ]);

    const cohortByActionId = new Map(
      perActionCohortMemberIds.map((r) => [r.actionId, r.memberIds]),
    );

    const participationCohortMemberIds = actionSuite
      ? perActionCohortMemberIds.some((r) => r.memberIds === null)
        ? null // at least one action targets everyone
        : new Set(
            perActionCohortMemberIds.flatMap((r) => [...(r.memberIds ?? [])]),
          )
      : cohortMemberIds;

    const idToUser = new Map(usersWithTags.map((user) => [user.id, user]));

    const userToHasCompletedAllActions = new Map<number, boolean>();
    for (const user of users) {
      const relevantActions = actions.filter((action) => {
        const memberIds = cohortByActionId.get(action.id);
        return !memberIds || memberIds.has(user.id);
      });
      userToHasCompletedAllActions.set(
        user.id,
        relevantActions.every((action) =>
          completionActivities.some(
            (activity) =>
              activity.userId === user.id && activity.actionId === action.id,
          ),
        ),
      );
    }

    return users
      .filter((user) =>
        computeShouldParticipate({
          eventDate: event.date,
          deadlineDate: deadlineEvent?.date ?? null,
          everyoneShouldComplete: event.action.everyoneShouldComplete,
          cohortMemberIds: participationCohortMemberIds,
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
    excludeOptionalActions?: boolean,
  ): Promise<User[]> {
    const uncompleted = (
      await this.findFilteredUsersForEvent(
        event,
        deadlineEvent,
        ActionEventNotifType.PersonalReminder,
        suite,
        excludeOptionalActions,
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
    excludeOptionalActions?: boolean,
  ): Promise<User[]> {
    const users = suite
      ? await this.userService.findActiveUsersWithTags()
      : await this.findBaseUsersForEvent({
          action: event.action,
          eventId: event.id,
        });
    return type === ActionEventNotifType.Announcement
      ? users
      : await this.filterForShouldRemind(
          users,
          event,
          deadlineEvent,
          suite,
          excludeOptionalActions,
        );
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
          group.excludeOptionalActions,
        );
        break;
      case ReminderCohortType.GroupLeadsWithUncompleted:
        return await this.findFilteredGroupLeads(
          group.memberActionEvent,
          group.deadlineEvent ?? null,
          ActionEventNotifType.PersonalReminder,
          group.actionSuite,
          group.excludeOptionalActions,
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
      group.excludeOptionalActions,
    );
  }
}
