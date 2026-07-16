import { ActionActivityType } from '@alliance/common/actionActivity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  answerMatchesFormField,
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
import { computeIsAssignedAndPresent } from 'src/utils/action-user';
import { yieldToEventLoop } from 'src/utils/event-loop';
import { In, type Repository } from 'typeorm';
import { ActionActivity } from '../actions/entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  CohortResolutionSession,
  type FormResponseAnswerRow,
} from './cohort-resolution-session';
import { ActionEventNotifType } from './entities/action-event-notif.entity';

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
   *
   * Pass the same `session` across related resolutions (all expressions of
   * one request/batch) so the active-user load and per-leaf queries are
   * shared instead of re-run per expression. `resolvingActionIds` is the
   * chain of InProgressAction ids currently being resolved above this call;
   * a leaf that re-enters an id already on the chain resolves to the empty
   * set, so cyclic expressions terminate.
   */
  async resolveCohortMemberIds(
    expression: CohortExpression | null | undefined,
    session: CohortResolutionSession = new CohortResolutionSession(),
    resolvingActionIds: ReadonlySet<number> = new Set(),
  ): Promise<Set<number>> {
    if (!expression) return new Set();
    // Memo key includes the chain: a sub-resolution reached through an
    // InProgressAction leaf must not await a pending ancestor resolution of
    // the same expression (self-deadlock on cycles).
    const chainKey = [...resolvingActionIds].sort((a, b) => a - b).join(',');
    const key = `${chainKey}|${JSON.stringify(expression)}`;
    let pending = session.expressionMemberIds.get(key);
    if (!pending) {
      pending = evaluateCohortExpression(
        expression,
        this.buildCohortContext(session, resolvingActionIds, chainKey),
      );
      session.expressionMemberIds.set(key, pending);
    }
    return pending;
  }

  private buildCohortContext(
    session: CohortResolutionSession,
    resolvingActionIds: ReadonlySet<number>,
    chainKey: string,
  ): CohortEvaluationContext {
    return {
      getUserIdsForTag: (tagId: string) => {
        if (!tagId) return Promise.resolve(new Set());
        let pending = session.tagUserIds.get(tagId);
        if (!pending) {
          pending = this.tagRepository
            .createQueryBuilder('tag')
            .innerJoin('tag.users', 'user')
            .select('user.id', 'userId')
            .where('tag.id = :tagId', { tagId })
            .getRawMany<{ userId: number }>()
            .then((rows) => new Set(rows.map((row) => Number(row.userId))));
          session.tagUserIds.set(tagId, pending);
        }
        return pending;
      },
      getUserIdsCompletedAction: (actionId: number) => {
        if (!actionId) return Promise.resolve(new Set());
        let pending = session.completedActionUserIds.get(actionId);
        if (!pending) {
          pending = this.actionActivityRepository
            .find({
              where: { actionId, type: ActionActivityType.USER_COMPLETED },
              select: { userId: true },
            })
            .then((activities) => new Set(activities.map((a) => a.userId)));
          session.completedActionUserIds.set(actionId, pending);
        }
        return pending;
      },
      getUserIdsInProgressAction: (actionId: number) => {
        if (!actionId) return Promise.resolve(new Set());
        // Cycle cut: this action's roster is already being resolved higher
        // up the chain, so its membership contributes nothing new.
        if (resolvingActionIds.has(actionId)) {
          return Promise.resolve(new Set());
        }
        const key = `${chainKey}|${actionId}`;
        let pending = session.inProgressActionUserIds.get(key);
        if (!pending) {
          pending = this.loadInProgressActionUserIds(
            actionId,
            session,
            new Set([...resolvingActionIds, actionId]),
          );
          session.inProgressActionUserIds.set(key, pending);
        }
        return pending;
      },
      getUserIdsForFormField: async (params) => {
        if (!params.formId) return new Set();
        let rows = session.formResponsesByFormId.get(params.formId);
        if (!rows) {
          rows = this.formResponseRepository
            .createQueryBuilder('response')
            .leftJoin('response.user', 'user')
            .select('response.answers', 'answers')
            .addSelect('user.id', 'userId')
            .where('response.formId = :formId', { formId: params.formId })
            .getRawMany<FormResponseAnswerRow>();
          session.formResponsesByFormId.set(params.formId, rows);
        }
        const matching = (await rows).filter((row) =>
          answerMatchesFormField(row.answers ?? undefined, params),
        );
        return new Set(
          matching
            .map((row) => row.userId)
            .filter((id): id is number => typeof id === 'number'),
        );
      },
      getGroupLeadUserIds: () =>
        (session.groupLeadUserIds ??= this.communityRepository
          .createQueryBuilder('community')
          .innerJoin('community.leaders', 'leader')
          .select('leader.id', 'userId')
          .getRawMany<{ userId: number }>()
          .then((rows) => new Set(rows.map((row) => Number(row.userId))))),
      // getActiveUsers primes candidateUserIds from its snapshot, so this
      // lean load only runs for sessions that never hydrate full users.
      getAllCandidateUserIds: () =>
        (session.candidateUserIds ??= this.userService
          .findActiveUserIds()
          .then((ids) => new Set(ids))),
    };
  }

  private async loadInProgressActionUserIds(
    actionId: number,
    session: CohortResolutionSession,
    resolvingActionIds: ReadonlySet<number>,
  ): Promise<Set<number>> {
    const action = await this.actionRepository.findOneOrFail({
      where: { id: actionId },
      relations: { events: true },
    });
    if (action.status !== ActionStatus.MemberAction) return new Set();
    const event = action.events.find(
      (e) => e.newStatus === ActionStatus.MemberAction,
    );
    if (!event) return new Set();
    const baseUsers = await this.findBaseUsersForEvent({
      action,
      eventId: event.id,
      session,
      resolvingActionIds,
      // Dismissal is a view-only "mark as seen" overlay (see
      // ActionActivityType.USER_DISMISSED) — it hides the card and mutes
      // reminders but doesn't end participation, so it must not drop the
      // user out of a cohort leaf's member set (matching the single-user
      // predicates, which never consider dismissal).
      includeDismissed: true,
    });
    const terminal = await this.actionActivityRepository.find({
      where: [
        { actionId, type: ActionActivityType.USER_COMPLETED },
        { actionId, type: ActionActivityType.USER_WONT_COMPLETE },
      ],
      select: { userId: true },
    });
    const terminalIds = new Set(terminal.map((a) => a.userId));
    return new Set(
      baseUsers.map((u) => u.id).filter((id) => !terminalIds.has(id)),
    );
  }

  /**
   * The session's shared active-user load (started on first use). Also claims
   * the session's NOT-universe so cohort resolution and base-user filtering
   * see one snapshot regardless of which starts first.
   */
  getActiveUsers(session: CohortResolutionSession): Promise<User[]> {
    return this.primeActiveUsers(session, () =>
      this.userService.findActiveUsersWithTags(),
    );
  }

  /**
   * Claim the session's active-user snapshot with a caller-chosen load —
   * e.g. `findActiveUsersForRoster` when the request only runs assignment
   * predicates. No-op if already claimed. The caller must make sure the
   * projection satisfies every consumer that will share this session.
   */
  primeActiveUsers(
    session: CohortResolutionSession,
    load: () => Promise<User[]>,
  ): Promise<User[]> {
    const users = (session.activeUsers ??= load());
    session.candidateUserIds ??= users.then(
      (us) => new Set(us.map((u) => u.id)),
    );
    return users;
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
    /** Share loads across calls within one request; see resolveCohortMemberIds. */
    session?: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Map<number, User[]>> {
    const { entries, includeSuspended, includeDismissed } = params;
    if (entries.length === 0) return new Map();
    const session = params.session ?? new CohortResolutionSession();
    const resolvingActionIds = params.resolvingActionIds ?? new Set<number>();

    const actionIds = entries.map((e) => e.action.id);

    // 1. One query: all active users (shared through the session)
    const allUsers = await this.getActiveUsers(session);

    // 2. One query: all dismissed activities for these actions
    const allDismissed = await this.actionActivityRepository.find({
      where: {
        actionId: In(actionIds),
        type: ActionActivityType.USER_DISMISSED,
      },
      select: { actionId: true, userId: true },
    });
    const dismissedByAction = new Map<number, Set<number>>();
    for (const act of allDismissed) {
      if (!dismissedByAction.has(act.actionId)) {
        dismissedByAction.set(act.actionId, new Set());
      }
      dismissedByAction.get(act.actionId)!.add(act.userId);
    }

    // 3. Cohort resolution — the session memoizes whole expressions and
    // individual leaves, so duplicates across entries resolve once.
    const cohortByAction = new Map<number, Promise<Set<number>>>();
    for (const { action } of entries) {
      cohortByAction.set(
        action.id,
        this.resolveCohortMemberIds(
          action.cohortExpression,
          session,
          resolvingActionIds,
        ),
      );
    }
    // Await all cohort resolutions in parallel
    await Promise.all(cohortByAction.values());

    // 4. Per-action filtering
    const result = new Map<number, User[]>();
    for (const { action, eventId } of entries) {
      // Analytics passes hundreds of entries, each filtering every active
      // user — CPU-bound work that would otherwise block the event loop for
      // the whole batch.
      await yieldToEventLoop();
      const events = action.events;
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        result.set(action.id, []);
        continue;
      }

      const deadlineDate = action.memberActionPhase.deadlineEvent?.date ?? null;
      const usersDismissed = dismissedByAction.get(action.id) ?? new Set();
      const cohortMemberIds = await cohortByAction.get(action.id)!;

      const eligible = allUsers.filter((user) =>
        computeIsAssignedAndPresent({
          user,
          eventDate: event.date,
          deadlineDate,
          cohortMemberIds,
          userDismissed: usersDismissed.has(user.id),
          onboarding: action.onboarding,
          includeSuspended,
          includeDismissed,
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
    session?: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<User[]> {
    const {
      action,
      eventId,
      includeSuspended,
      includeDismissed,
      session,
      resolvingActionIds,
    } = params;

    if (!action.events.some((event) => event.id === eventId)) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const result = await this.findBaseUsersForEvents({
      entries: [{ action, eventId }],
      includeSuspended,
      includeDismissed,
      session,
      resolvingActionIds,
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

    const session = new CohortResolutionSession();
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
      this.resolveCohortMemberIds(event.action.cohortExpression, session),
      Promise.all(
        actions.map(async (action) => ({
          actionId: action.id,
          memberIds: await this.resolveCohortMemberIds(
            action.cohortExpression,
            session,
          ),
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
      ? new Set(perActionCohortMemberIds.flatMap((r) => [...r.memberIds]))
      : cohortMemberIds;

    const idToUser = new Map(usersWithTags.map((user) => [user.id, user]));

    const userToHasCompletedAllActions = new Map<number, boolean>();
    for (const user of users) {
      const relevantActions = actions.filter((action) => {
        const memberIds = cohortByActionId.get(action.id);
        return memberIds!.has(user.id);
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
        computeIsAssignedAndPresent({
          user: idToUser.get(user.id)!,
          eventDate: event.date,
          deadlineDate: deadlineEvent?.date ?? null,
          cohortMemberIds: participationCohortMemberIds,
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
