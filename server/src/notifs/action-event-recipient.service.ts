import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TERMINAL_ACTIVITY_TYPES } from "src/actions/action-activity-status";
import { ActionBranchService } from "src/actions/action-branch.service";
import { CohortResolutionSession } from "src/actions/cohort-resolution-session";
import { CohortResolverService } from "src/actions/cohort-resolver.service";
import {
  ActionSuite,
  loadedActionSuiteActions,
} from "src/actions/entities/action-suite.entity";
import {
  loadedReminderGroupMemberActionEvent,
  ReminderCohortType,
  ReminderGroup,
} from "src/actions/entities/reminder-group.entity";
import { CommunityService } from "src/community/community.service";
import { loadedTagUsers } from "src/user/entities/tag.entity";
import { computeIsAssignedAndPresent } from "src/utils/action-user";
import { yieldToEventLoop } from "src/utils/event-loop";
import { In, type Repository } from "typeorm";
import { ActionActivity } from "../actions/entities/action-activity.entity";
import {
  ActionEvent,
  loadedActionEventAction,
} from "../actions/entities/action-event.entity";
import {
  Action,
  loadedActionEvents,
  parseAction,
  type ParsedAction,
} from "../actions/entities/action.entity";
import { User } from "../user/entities/user.entity";
import { TagService } from "../user/tag.service";
import { UserService } from "../user/user.service";
import { ActionEventNotifType } from "./entities/action-event-notif.entity";

@Injectable()
export class ActionEventRecipientService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly communityService: CommunityService,
    private readonly userService: UserService,
    private readonly tagService: TagService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly actionBranchService: ActionBranchService,
  ) {}

  /**
   * Batched version of findBaseUsersForEvent: loads shared data once
   * (active users, cohort expressions) and filters per action. Returns a map
   * from actionId -> eligible users.
   */
  public async findBaseUsersForEvents(params: {
    entries: Array<{ action: ParsedAction; eventId: number }>;
    includeSuspended?: boolean;
    /** Share loads across calls within one request; see CohortResolverService.resolveCohortMemberIds. */
    session?: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Map<number, User[]>> {
    const { entries, includeSuspended } = params;
    if (entries.length === 0) return new Map();
    const session = params.session ?? new CohortResolutionSession();
    const resolvingActionIds = params.resolvingActionIds ?? new Set<number>();

    // 1. One query: all active users (shared through the session)
    const allUsers = await this.cohortResolverService.getActiveUsers(session);

    // 2. Cohort resolution — the session memoizes whole expressions and
    // individual leaves, so duplicates across entries resolve once.
    const cohortByAction = new Map<number, Promise<Set<number>>>();
    for (const { action } of entries) {
      cohortByAction.set(
        action.id,
        this.cohortResolverService.resolveCohort({
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
      const event = loadedActionEvents(action).find((e) => e.id === eventId);
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

    if (!loadedActionEvents(action).some((event) => event.id === eventId)) {
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
    event: Pick<ActionEvent, "newStatus" | "action" | "date" | "id">,
    deadlineEvent: Pick<ActionEvent, "newStatus" | "action" | "date"> | null,
    actionSuite?: ActionSuite,
    excludeOptionalActions?: boolean,
  ): Promise<User[]> {
    const rawEventAction = loadedActionEventAction(event);
    // Callers load suite actions without their events, which the
    // saved-decision reads need.
    const scopeIds = (
      actionSuite ? loadedActionSuiteActions(actionSuite) : [rawEventAction]
    ).map((action) => action.id);
    const actionsById = new Map(
      (
        await this.actionRepository.find({
          where: { id: In([...new Set([rawEventAction.id, ...scopeIds])]) },
          relations: { events: true },
        })
      ).map((action) => [action.id, parseAction(action)]),
    );
    const loaded = (id: number) => {
      const action = actionsById.get(id);
      if (!action) throw new Error(`action ${id} was deleted mid-request`);
      return action;
    };
    const eventAction = loaded(rawEventAction.id);
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
      optionalBranchMembers,
    ] = await Promise.all([
      this.userService.findByIds(
        users.map((user) => user.id),
        { tags: true, awayRanges: true, contractEvents: true },
      ),
      this.cohortResolverService.resolveCohort({
        action: eventAction,
        session,
      }),
      Promise.all(
        actions.map(async (action) => ({
          actionId: action.id,
          memberIds: await this.cohortResolverService.resolveCohort({
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
      this.actionBranchService.findOptionalBranchMemberIds({
        actionIds: [eventAction.id, ...actions.map((action) => action.id)],
      }),
    ]);

    const heldMemberIds = (actionId: number, memberIds: Set<number>) => {
      const optional = optionalBranchMembers.get(actionId);
      return optional
        ? new Set([...memberIds].filter((id) => !optional.has(id)))
        : memberIds;
    };
    const cohortByActionId = new Map(
      perActionCohortMemberIds.map((r) => [
        r.actionId,
        heldMemberIds(r.actionId, r.memberIds),
      ]),
    );

    const participationCohortMemberIds = actionSuite
      ? new Set([...cohortByActionId.values()].flatMap((ids) => [...ids]))
      : heldMemberIds(eventAction.id, cohortMemberIds);

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
          onboarding: rawEventAction.onboarding,
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

    return this.communityService.findLeadersOfCommunitiesWithUsers(uncompleted);
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
          action: parseAction(loadedActionEventAction(event)),
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
    const memberActionEvent = loadedReminderGroupMemberActionEvent(group);
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
          memberActionEvent,
          group.deadlineEvent ?? null,
          ActionEventNotifType.PersonalReminder,
          group.actionSuite,
          group.excludeOptionalActions,
        );
        break;
      case ReminderCohortType.GroupLeadsWithUncompleted:
        return await this.findFilteredGroupLeads(
          memberActionEvent,
          group.deadlineEvent ?? null,
          group.actionSuite,
          group.excludeOptionalActions,
        );
      case ReminderCohortType.Tag:
        if (!group.userTag) {
          throw new Error("Group cohort type requires user tag");
        }
        const userTag = await this.tagService.findTagOrFail(group.userTag.id);
        users = loadedTagUsers(userTag);
        break;
      default:
        throw new Error(
          `Invalid cohort type: ${group.cohortType satisfies never}`,
        );
    }
    return this.filterForShouldRemind(
      users,
      memberActionEvent,
      group.deadlineEvent ?? null,
      group.actionSuite,
      group.excludeOptionalActions,
    );
  }
}
