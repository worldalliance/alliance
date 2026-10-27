import { ActionActivityType } from "@alliance/common/actionActivity";
import { expressionHasLeaf } from "@alliance/common/cohort-expression";
import { run } from "@alliance/common/run";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommunityService } from "src/community/community.service";
import {
  Community,
  loadedCommunityUsers,
} from "src/community/entities/community.entity";
import {
  UserActionRelationDetail,
  UserActionRelationPillStatus,
  UserActionRelations,
  UserActionRelationsForUser,
  UserActionSummary,
} from "src/user/dto/user-action-relations.dto";
import { User } from "src/user/entities/user.entity";
import {
  computeIsAwayDuringWindow,
  hasMemberActionDeadlinePassed,
} from "src/utils/action-user";
import { yieldToEventLoop } from "src/utils/event-loop";
import { In, type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import {
  findLatestTerminalActivity,
  sqlIsLatestCompletion,
} from "./action-activity-status";
import { ActionParticipantsService } from "./action-participants.service";
import { ActionsService } from "./actions.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionStatus } from "./entities/action-event.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import { type ParsedAction } from "./entities/action.entity";
import { resolveUserActionPillStatus } from "./user-action-pill-status";

@Injectable()
export class ActionRelationsService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly actionsService: ActionsService,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly participants: ActionParticipantsService,
  ) {}

  async findActionRelationsForUsers(
    usersP: Promise<User[]>,
    actionLimit: number = 8,
    session: CohortResolutionSession = new CohortResolutionSession(),
  ): Promise<UserActionRelations> {
    const actionsP: Promise<ParsedAction[]> = run(async () => {
      const actions = await this.actionsService.findAllSorted(
        { events: true, suite: true },
        actionLimit,
      );
      return actions.filter(
        (action) =>
          !action.archived &&
          action.status !== ActionStatus.Draft &&
          !action.publicOnly,
      );
    });

    const userIdsP = usersP.then((users) => users.map((user) => user.id));
    const userIdsSetP = userIdsP.then((userIds) => new Set(userIds));

    const joinedUsersP: Promise<Record<number, number[]>> = run(async () => {
      const actions = await actionsP;
      const joinedUsersMap =
        await this.participants.findParticipantIdsForActions(actions, {
          session,
        });

      const userIdsSet = await userIdsSetP;
      const joinedUsers: Record<number, number[]> = {};
      for (const action of actions) {
        joinedUsers[action.id] = (joinedUsersMap.get(action.id) ?? []).filter(
          (uid) => userIdsSet.has(uid),
        );
      }
      return joinedUsers;
    });

    const suitesP: Promise<ActionSuite[]> = run(async () => {
      const actions = await actionsP;
      return await this.actionSuiteRepository.find({
        where: { id: In(actions.map((a) => a.suite?.id)) },
      });
    });

    /** oldest activity first */
    const temporallySortedActivitiesP = run(async () => {
      const actions = await actionsP;
      const actionIds = actions.map((a) => a.id);
      return this.actionActivityRepository.find({
        where: { actionId: In(actionIds), userId: In(await userIdsP) },
        order: { createdAt: "ASC" },
      });
    });

    // --- end of promise defs ---

    const now = new Date();
    const users = await usersP;
    const userById = new Map(users.map((user) => [user.id, user]));
    const actions = await actionsP;

    const actionSummaries: UserActionSummary[] = actions.map((action) => {
      return {
        id: action.id,
        name: action.name,
        status: action.status,
        weekNumber: action.deadlineWeekNumber,
        allMembersParticipating: expressionHasLeaf(
          action.cohortExpression,
          (leaf) => leaf.type === "AllMembers",
        ),
        suiteId: action.suite?.id,
        memberActionDeadline:
          action.memberActionPhase?.deadlineEvent?.date?.getTime() ?? null,
      } satisfies UserActionSummary;
    });

    const actionIds = actions.map((a) => a.id);
    const actionOrder = new Map(actionIds.map((id, index) => [id, index]));

    const relationByUserThenAction = new Map<
      number,
      Map<
        number,
        Omit<UserActionRelationDetail, "latestActivityAt"> & {
          latestActivityAt?: Date;
          // Transient resolver inputs; not serialized (see final mapping below).
          isJoined: boolean;
          isAway: boolean;
          activities: ActionActivity[];
        }
      >
    >();
    function getDetail(params: { userId: number; actionId: number }) {
      const { userId, actionId } = params;
      if (!relationByUserThenAction.has(userId)) {
        relationByUserThenAction.set(userId, new Map());
      }
      if (!relationByUserThenAction.get(userId)!.has(actionId)) {
        relationByUserThenAction.get(userId)!.set(actionId, {
          actionId,
          status: UserActionRelationPillStatus.NotRequired,
          declineReason: undefined,
          isMoral: undefined,
          outOfTime: undefined,
          isJoined: false,
          isAway: false,
          activities: [],
        });
      }
      return relationByUserThenAction.get(userId)!.get(actionId)!;
    }

    // Status is resolved in one pass below, not in this gather loop.
    const actionById = new Map(actions.map((action) => [action.id, action]));
    const joinedUsers = await joinedUsersP;
    const userIds = await userIdsP;
    for (const action of actions) {
      // This users × actions pass is pure CPU; yield so concurrent requests
      // aren't starved for the whole matrix.
      await yieldToEventLoop();
      for (const userId of joinedUsers[action.id]) {
        getDetail({ userId, actionId: action.id }).isJoined = true;
      }
      // Set-based membership from the shared session (already resolved for
      // this action by findParticipantIdsForActions) instead of the
      // per-user expression walk, whose action leaves each hit the DB.
      const cohortMemberIds = await this.cohortResolverService.resolveCohort({
        action,
        session,
      });
      for (const userId of userIds) {
        const detail = getDetail({ userId, actionId: action.id });
        if (
          cohortMemberIds.has(userId) &&
          computeIsAwayDuringWindow({
            user: userById.get(userId)!,
            action,
          })
        ) {
          detail.isAway = true;
        }
      }
    }

    for (const activity of await temporallySortedActivitiesP) {
      const detail = getDetail({
        userId: activity.userId,
        actionId: activity.actionId,
      });
      // latestActivity* track the last activity of *any* type; the terminal
      // (status-bearing) one is resolved in the pass below.
      detail.latestActivityAt = activity.createdAt;
      detail.latestActivityType = activity.type;
      detail.activities.push(activity);
    }

    for (const actionMap of relationByUserThenAction.values()) {
      for (const [actionId, detail] of actionMap) {
        const action = actionById.get(actionId)!;
        const terminal = findLatestTerminalActivity(detail.activities);

        let activityStatus: UserActionRelationPillStatus | null = null;
        if (terminal) {
          switch (terminal.type) {
            case ActionActivityType.USER_COMPLETED:
              activityStatus = UserActionRelationPillStatus.Completed;
              break;
            case ActionActivityType.USER_WONT_COMPLETE:
              activityStatus = UserActionRelationPillStatus.WontComplete;
              // Surface withdrawal reason for the leader view.
              detail.declineReason = terminal.declineReason ?? undefined;
              detail.isMoral = terminal.isMoral ?? undefined;
              detail.outOfTime = terminal.outOfTime ?? undefined;
              break;
            default:
              throw new Error(
                `unknown terminal activity type: ${terminal.type satisfies never}`,
              );
          }
        }

        detail.status = resolveUserActionPillStatus({
          isJoined: detail.isJoined,
          isAway: detail.isAway,
          optional: action.optional,
          deadlinePassed: hasMemberActionDeadlinePassed(
            action.memberActionPhase?.deadlineEvent?.date,
            now,
          ),
          activityStatus,
        });
      }
    }

    const userRelations: UserActionRelationsForUser[] = Array.from(
      relationByUserThenAction.entries(),
    ).map(([userId, actionMap]) => {
      const relations: UserActionRelationDetail[] = Array.from(
        actionMap.entries(),
      )
        .map(([actionId, detail]) => ({
          actionId,
          status: detail.status,
          latestActivityType: detail.latestActivityType,
          latestActivityAt: detail.latestActivityAt?.toISOString(),
          declineReason: detail.declineReason,
          isMoral: detail.isMoral,
          outOfTime: detail.outOfTime,
        }))
        .sort(
          (a, b) =>
            (actionOrder.get(a.actionId) ?? 0) -
            (actionOrder.get(b.actionId) ?? 0),
        );

      return {
        userId,
        relations,
      } satisfies UserActionRelationsForUser;
    });

    return {
      actions: actionSummaries,
      suites: await suitesP,
      users: userRelations,
    };
  }

  async findUserActionRelations(): Promise<UserActionRelations> {
    // One user load for the whole request: the roster projection claims the
    // session's active-user snapshot, so the base-user resolution inside
    // findParticipantIdsForActions reuses it instead of re-hydrating every
    // user. The relations matrix only reads what the projection carries.
    const session = new CohortResolutionSession();
    const usersPromise = this.cohortResolverService.primeActiveUsers(
      session,
      () => this.userService.findActiveUsersForRoster(),
    );
    return this.findActionRelationsForUsers(usersPromise, undefined, session);
  }

  async findUserActionRelationsForUser(
    userId: number,
  ): Promise<UserActionRelations> {
    const userPromise = this.userService
      .findOneOrFail(userId, {
        awayRanges: true,
        contractEvents: true,
        tags: true,
      })
      .then((user) => [user]);
    return this.findActionRelationsForUsers(userPromise, 100);
  }

  async findMemberInfoByCommunityId(
    communityId: number,
  ): Promise<UserActionRelations> {
    const usersPromise = this.communityService
      .findOneOrFail(communityId, {
        users: { awayRanges: true, contractEvents: true, tags: true },
      })
      .then(loadedCommunityUsers);
    return this.findActionRelationsForUsers(usersPromise);
  }

  async findMemberInfo(
    userId: number,
    communityId: number,
  ): Promise<UserActionRelations> {
    const community = await this.communityService.findOneOrFail(communityId, {
      users: { awayRanges: true, contractEvents: true, tags: true },
    });
    const members = loadedCommunityUsers(community);
    if (!members.some((user) => user.id === userId)) {
      throw new NotFoundException("User is not a member of this community");
    }

    return this.findActionRelationsForUsers(Promise.resolve(members));
  }

  async countCommunityCompletedActions(
    userId: number,
    communityId: number,
  ): Promise<number> {
    const memberRow = await this.communityRepository
      .createQueryBuilder("c")
      .select("c.id", "id")
      .innerJoin(
        "community_users_user",
        "cuu",
        'cuu."communityId" = c.id AND cuu."userId" = :userId',
        { userId },
      )
      .where("c.id = :communityId", { communityId })
      .getRawOne<{ id: number }>();

    if (!memberRow) {
      await this.communityRepository.findOneOrFail({
        where: { id: communityId },
        select: { id: true },
      });
      throw new NotFoundException("User is not a member of this community");
    }

    return this.actionActivityRepository
      .createQueryBuilder("activity")
      .innerJoin(
        "community_users_user",
        "cuu",
        'cuu."userId" = activity.userId AND cuu."communityId" = :communityId',
        { communityId },
      )
      .where(sqlIsLatestCompletion("activity"))
      .getCount();
  }
}
