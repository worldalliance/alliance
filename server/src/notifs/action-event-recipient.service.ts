/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TERMINAL_ACTIVITY_TYPES } from "src/actions/action-activity-status";
import { CohortAdmissionService } from "src/actions/cohort-admission.service";
import { readsSavedDecisions } from "src/actions/cohort-decision";
import {
  answerMatchesFormField,
  evaluateCohortExpression,
  type CohortEvaluationContext,
} from "src/actions/cohort-expression.evaluator";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import {
  ReminderCohortType,
  ReminderGroup,
} from "src/actions/entities/reminder-group.entity";
import { PrerequisiteProgressService } from "src/actions/prerequisite-progress.service";
import { CommunityService } from "src/community/community.service";
import { Community } from "src/community/entities/community.entity";
import { resolveUsMembership, UsMembership } from "src/geo/us-membership";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { loadedTagUsers, Tag } from "src/user/entities/tag.entity";
import {
  canMissActionDeadline,
  computeIsAssignedAndPresent,
  computeMissedActionDeadline,
} from "src/utils/action-user";
import { yieldToEventLoop } from "src/utils/event-loop";
import { In, type Repository } from "typeorm";
import { ActionActivity } from "../actions/entities/action-activity.entity";
import { ActionEvent } from "../actions/entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "../actions/entities/action.entity";
import { User } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import {
  CohortResolutionSession,
  type FormResponseAnswerRow,
} from "./cohort-resolution-session";
import { ActionEventNotifType } from "./entities/action-event-notif.entity";

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityService: CommunityService,
    private readonly userService: UserService,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
    private readonly cohortAdmissionService: CohortAdmissionService,
  ) {}

  /**
   * Resolve a cohort expression to a set of matching user IDs using batch
   * set-based queries (one query per leaf type, not per user).
   *
   * Pass the same `session` across related resolutions (all expressions of
   * one request/batch) so the active-user load and per-leaf queries are
   * shared instead of re-run per expression. `resolvingActionIds` is the
   * chain of action ids currently being resolved above this call through
   * `MissedActionDeadline` leaves; a leaf that re-enters an id already on the
   * chain resolves to the empty set, so cyclic expressions terminate.
   */
  async resolveCohortMemberIds(
    expression: CohortExpression | null | undefined,
    session: CohortResolutionSession = new CohortResolutionSession(),
    resolvingActionIds: ReadonlySet<number> = new Set(),
  ): Promise<Set<number>> {
    if (!expression) return new Set();
    // Memo key includes the chain: a sub-resolution reached through an
    // action-referencing leaf must not await a pending ancestor resolution
    // of the same expression (self-deadlock on cycles).
    const chainKey = [...resolvingActionIds].sort((a, b) => a - b).join(",");
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

  /**
   * An action's live cohort: the members its expression selects whose
   * prerequisites have all resolved.
   */
  async resolveActionCohortMemberIds(params: {
    action: Pick<ParsedAction, "cohortExpression" | "prerequisiteActionIds">;
    session: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Set<number>> {
    const { action, session, resolvingActionIds } = params;
    const [cohort, isReady] = await Promise.all([
      this.resolveCohortMemberIds(
        action.cohortExpression,
        session,
        resolvingActionIds,
      ),
      this.prerequisiteProgressService.loadReadiness({
        action,
        session,
        now: new Date(),
      }),
    ]);
    return new Set([...cohort].filter(isReady));
  }

  /**
   * An action's cohort as its readers see it. Saved decisions stand in for the
   * live cohort from launch on, so a member the pass has not decided yet reads
   * as outside it; see `readsSavedDecisions`.
   */
  resolveCohort(params: {
    action: ParsedAction;
    session: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Set<number>> {
    const { action, session, resolvingActionIds } = params;
    if (readsSavedDecisions(action, new Date())) {
      return this.cohortAdmissionService.loadAdmittedMemberIds(
        action.id,
        session,
      );
    }
    return this.resolveActionCohortMemberIds({
      action,
      session,
      resolvingActionIds,
    });
  }

  /**
   * An action's cohort taking each member's saved decision where one exists
   * and the live cohort otherwise, for readers that must not count an
   * undecided member as outside.
   */
  async resolveDecidedCohort(params: {
    action: ParsedAction;
    session: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Set<number>> {
    const { action, session, resolvingActionIds } = params;
    const live = this.resolveActionCohortMemberIds({
      action,
      session,
      resolvingActionIds,
    });
    if (!readsSavedDecisions(action, new Date())) {
      return live;
    }
    const [decisions, liveIds] = await Promise.all([
      this.cohortAdmissionService.loadDecisionsForAction(action.id, session),
      live,
    ]);
    return new Set([
      ...[...decisions].flatMap(([userId, included]) =>
        included ? [userId] : [],
      ),
      ...[...liveIds].filter((userId) => !decisions.has(userId)),
    ]);
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
            .createQueryBuilder("tag")
            .innerJoin("tag.users", "user")
            .select("user.id", "userId")
            .where("tag.id = :tagId", { tagId })
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
      getUserIdsMissedActionDeadline: (actionId: number) => {
        if (!actionId) return Promise.resolve(new Set());
        // Cycle cut: this action's roster is already being resolved higher
        // up the chain, so its membership contributes nothing new.
        if (resolvingActionIds.has(actionId)) {
          return Promise.resolve(new Set());
        }
        const key = `${chainKey}|${actionId}`;
        let pending = session.missedActionDeadlineUserIds.get(key);
        if (!pending) {
          pending = this.loadMissedActionDeadlineUserIds(
            actionId,
            session,
            new Set([...resolvingActionIds, actionId]),
          );
          session.missedActionDeadlineUserIds.set(key, pending);
        }
        return pending;
      },
      getUserIdsForFormField: async (params) => {
        if (!params.formId) return new Set();
        let rows = session.formResponsesByFormId.get(params.formId);
        if (!rows) {
          rows = this.formResponseRepository
            .createQueryBuilder("response")
            .leftJoin("response.user", "user")
            .select("response.answers", "answers")
            .addSelect("user.id", "userId")
            .where("response.formId = :formId", { formId: params.formId })
            .getRawMany<FormResponseAnswerRow>();
          session.formResponsesByFormId.set(params.formId, rows);
        }
        const matching = (await rows).filter((row) =>
          answerMatchesFormField(row.answers ?? undefined, params),
        );
        return new Set(
          matching
            .map((row) => row.userId)
            .filter((id): id is number => typeof id === "number"),
        );
      },
      getGroupLeadUserIds: () =>
        (session.groupLeadUserIds ??= this.communityRepository
          .createQueryBuilder("community")
          .innerJoin("community.leaders", "leader")
          .select("leader.id", "userId")
          .getRawMany<{ userId: number }>()
          .then((rows) => new Set(rows.map((row) => Number(row.userId))))),
      getUserIdsByUsMembership: async (membership) =>
        (
          await (session.usMembershipUserIds ??= this.loadUsMembershipUserIds())
        )[membership],
      // getActiveUsers primes candidateUserIds from its snapshot, so this
      // lean load only runs for sessions that never hydrate full users.
      getAllCandidateUserIds: () =>
        (session.candidateUserIds ??= this.userService
          .findActiveUserIds()
          .then((ids) => new Set(ids))),
      getStaffUserIds: () =>
        (session.staffUserIds ??= this.userRepository
          .find({ where: { staff: true }, select: { id: true } })
          .then((users) => new Set(users.map((user) => user.id)))),
    };
  }

  /**
   * Partition every user by where they live, in one pass. The city on the
   * profile wins; time zone is the fallback. Users we can't place land in
   * `Unknown` and so match neither country leaf.
   */
  private async loadUsMembershipUserIds(): Promise<
    Record<UsMembership, Set<number>>
  > {
    const rows = await this.userRepository
      .createQueryBuilder("user")
      .leftJoin("user.city", "city")
      .select("user.id", "userId")
      .addSelect("user.timeZone", "timeZone")
      .addSelect("city.countryCode", "countryCode")
      .getRawMany<{
        userId: number;
        timeZone: string | null;
        countryCode: string | null;
      }>();

    const byMembership: Record<UsMembership, Set<number>> = {
      [UsMembership.Us]: new Set(),
      [UsMembership.NonUs]: new Set(),
      [UsMembership.Unknown]: new Set(),
    };
    for (const row of rows) {
      byMembership[resolveUsMembership(row)].add(Number(row.userId));
    }
    return byMembership;
  }

  // A deleted action matches nobody, as on the single-member path.
  private async loadRosterLeafAction(
    actionId: number,
  ): Promise<ParsedAction | null> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: { events: true },
    });
    return action && parseAction(action);
  }

  private async loadMissedActionDeadlineUserIds(
    actionId: number,
    session: CohortResolutionSession,
    resolvingActionIds: ReadonlySet<number>,
  ): Promise<Set<number>> {
    const action = await this.loadRosterLeafAction(actionId);
    const now = new Date();
    if (!action || !canMissActionDeadline(action, now)) return new Set();
    const [users, cohortMemberIds, terminalUserIds] = await Promise.all([
      this.getActiveUsers(session),
      this.resolveDecidedCohort({ action, session, resolvingActionIds }),
      this.prerequisiteProgressService.loadTerminalUserIds(action.id),
    ]);
    return new Set(
      users
        .filter((user) =>
          computeMissedActionDeadline({
            action,
            user,
            inCohort: cohortMemberIds.has(user.id),
            hasTerminalActivity: terminalUserIds.has(user.id),
            now,
          }),
        )
        .map((user) => user.id),
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
   * (active users, cohort expressions) and filters per action. Returns a map
   * from actionId -> eligible users.
   */
  public async findBaseUsersForEvents(params: {
    entries: Array<{ action: ParsedAction; eventId: number }>;
    includeSuspended?: boolean;
    /** Share loads across calls within one request; see resolveCohortMemberIds. */
    session?: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Map<number, User[]>> {
    const { entries, includeSuspended } = params;
    if (entries.length === 0) return new Map();
    const session = params.session ?? new CohortResolutionSession();
    const resolvingActionIds = params.resolvingActionIds ?? new Set<number>();

    // 1. One query: all active users (shared through the session)
    const allUsers = await this.getActiveUsers(session);

    // 2. Cohort resolution — the session memoizes whole expressions and
    // individual leaves, so duplicates across entries resolve once.
    const cohortByAction = new Map<number, Promise<Set<number>>>();
    for (const { action } of entries) {
      cohortByAction.set(
        action.id,
        this.resolveCohort({
          action,
          session,
          resolvingActionIds,
        }),
      );
    }
    // Await all cohort resolutions in parallel
    await Promise.all(cohortByAction.values());

    // 3. Per-action filtering
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
      const cohortMemberIds = await cohortByAction.get(action.id)!;

      const eligible = allUsers.filter((user) =>
        computeIsAssignedAndPresent({
          user,
          eventDate: event.date,
          deadlineDate,
          cohortMemberIds,
          onboarding: action.onboarding,
          includeSuspended,
        }),
      );

      result.set(action.id, eligible);
    }

    return result;
  }

  public async findBaseUsersForEvent(params: {
    action: ParsedAction;
    eventId: number;
    includeSuspended?: boolean;
    session?: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<User[]> {
    const { action, eventId, includeSuspended, session, resolvingActionIds } =
      params;

    if (!action.events.some((event) => event.id === eventId)) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const result = await this.findBaseUsersForEvents({
      entries: [{ action, eventId }],
      includeSuspended,
      session,
      resolvingActionIds,
    });
    return result.get(action.id) ?? [];
  }

  async filterForShouldRemind(
    users: User[],
    event: Pick<ActionEvent, "newStatus" | "action" | "date">,
    deadlineEvent: Pick<ActionEvent, "newStatus" | "action" | "date"> | null,
    actionSuite?: ActionSuite,
    excludeOptionalActions?: boolean,
  ): Promise<User[]> {
    // Callers load suite actions without their events, which the
    // saved-decision reads need.
    const scopeIds = (actionSuite?.actions ?? [event.action]).map(
      (action) => action.id,
    );
    const actionsById = new Map(
      (
        await this.actionRepository.find({
          where: { id: In([...new Set([event.action.id, ...scopeIds])]) },
          relations: { events: true },
        })
      ).map((action) => [action.id, parseAction(action)]),
    );
    const loaded = (id: number) => {
      const action = actionsById.get(id);
      if (!action) throw new Error(`action ${id} was deleted mid-request`);
      return action;
    };
    const eventAction = loaded(event.action.id);
    const pre_actions = scopeIds.map(loaded);
    const actions = excludeOptionalActions
      ? pre_actions.filter((action) => !action.optional)
      : pre_actions;

    const session = new CohortResolutionSession();
    const [
      usersWithTags,
      cohortMemberIds,
      perActionCohortMemberIds,
      completionActivities,
    ] = await Promise.all([
      this.userService.findByIds(
        users.map((user) => user.id),
        { tags: true, awayRanges: true, contractEvents: true },
      ),
      this.resolveCohort({
        action: eventAction,
        session,
      }),
      Promise.all(
        actions.map(async (action) => ({
          actionId: action.id,
          memberIds: await this.resolveCohort({
            action,
            session,
          }),
        })),
      ),
      this.actionActivityRepository.find({
        where: {
          userId: In(users.map((user) => user.id)),
          actionId: In(actions.map((action) => action.id)),
          type: In(TERMINAL_ACTIVITY_TYPES),
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
          onboarding: event.action.onboarding,
        }),
      )
      .filter((user) => !userToHasCompletedAllActions.get(user.id));
  }

  async findFilteredGroupLeads(
    event: Pick<ActionEvent, "newStatus" | "action" | "date" | "id">,
    deadlineEvent: Pick<ActionEvent, "newStatus" | "action" | "date"> | null,
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
    event: Pick<ActionEvent, "newStatus" | "action" | "date" | "id">,
    deadlineEvent: Pick<ActionEvent, "newStatus" | "action" | "date"> | null,
    type: ActionEventNotifType,
    suite?: ActionSuite,
    excludeOptionalActions?: boolean,
  ): Promise<User[]> {
    const users = suite
      ? await this.userService.findActiveUsersWithTags()
      : await this.findBaseUsersForEvent({
          // The event relation carries a raw db entity; parse at first use.
          action: parseAction(event.action),
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
          throw new Error("Custom cohort type requires users");
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
          group.actionSuite,
          group.excludeOptionalActions,
        );
      case ReminderCohortType.Tag:
        if (!group.userTag) {
          throw new Error("Group cohort type requires user tag");
        }
        const userTag = await this.userService.findTagOrFail(group.userTag.id);
        users = loadedTagUsers(userTag);
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
