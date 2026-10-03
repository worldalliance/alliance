import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { CohortAdmissionService } from "./cohort-admission.service";
import { ActionStatus } from "./entities/action-event.entity";
import {
  Action,
  actionStatusAt,
  parseAction,
  type ParsedAction,
  VisibilityMode,
} from "./entities/action.entity";
import { SingleMemberCohortService } from "./single-member-cohort.service";
import { isStaffPreviewActiveFor } from "./staff-preview";

const ACTION_VISIBILITY_USER_RELATIONS = {
  tags: true,
  contractEvents: true,
  awayRanges: true,
} as const;

type ActionAccessParams = {
  action: ParsedAction;
  user: User | null;
  session?: CohortResolutionSession;
  now?: Date;
};

@Injectable()
export class ActionVisibilityService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cohortAdmissionService: CohortAdmissionService,
    private readonly singleMemberCohortService: SingleMemberCohortService,
  ) {}

  /** Whether the action's page opens for the user: a public-only action opens for anyone, though feeds leave it out. */
  async userCanOpenAction(params: ActionAccessParams): Promise<boolean> {
    return params.action.publicOnly || this.userCanSeeAction(params);
  }

  async userCanSeeAction(params: ActionAccessParams): Promise<boolean> {
    const { action, user, session, now = new Date() } = params;
    if (user?.admin) {
      return true;
    }
    if (action.archived) {
      return false;
    }
    if (user && isStaffPreviewActiveFor({ user, action, now })) {
      return true;
    }
    if (actionStatusAt(action.events, now) === ActionStatus.Draft) {
      return false;
    }
    if (action.visibilityMode === VisibilityMode.Public) {
      return true;
    }

    if (!user) {
      return false;
    }
    if (action.visibilityMode === VisibilityMode.AllMembers) {
      return true;
    }

    if (!action.cohortExpression) {
      return false;
    }

    const shared = session ?? new CohortResolutionSession();
    if (
      (
        await this.cohortAdmissionService.loadAdmittedActionIds(user.id, shared)
      ).has(action.id)
    ) {
      return true;
    }
    return this.singleMemberCohortService.computeIsInActionCohort({
      user,
      action,
      session: shared,
    });
  }

  async loadUserForActionVisibility(userId?: number): Promise<User | null> {
    if (userId == null) {
      return null;
    }
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ACTION_VISIBILITY_USER_RELATIONS,
    });
  }

  private async loadActionsForVisibility(
    actionIds: number[],
  ): Promise<ParsedAction[]> {
    const actions = await this.actionRepository.find({
      where: { id: In(actionIds) },
      relations: { events: true },
    });
    return actions.map(parseAction);
  }

  private async visibleActionIdsAmong(params: {
    actions: ParsedAction[];
    user: User | null;
    session: CohortResolutionSession;
    now?: Date;
    allows: (params: ActionAccessParams) => Promise<boolean>;
  }): Promise<Set<number>> {
    const { actions, user, session, now, allows } = params;
    const visible = new Set<number>();
    for (const action of actions) {
      if (await allows({ action, user, session, now })) {
        visible.add(action.id);
      }
    }
    return visible;
  }

  async visibleActionIdsForUser(params: {
    actionIds: Iterable<number>;
    user?: User | null;
    userId?: number;
    session?: CohortResolutionSession;
  }): Promise<Set<number>> {
    const uniqueIds = [...new Set(params.actionIds)];
    if (uniqueIds.length === 0) {
      return new Set();
    }

    const session = params.session ?? new CohortResolutionSession();
    const user =
      params.user !== undefined
        ? params.user
        : await this.loadUserForActionVisibility(params.userId);

    return this.visibleActionIdsAmong({
      actions: await this.loadActionsForVisibility(uniqueIds),
      user,
      session,
      allows: (access) => this.userCanSeeAction(access),
    });
  }

  /**
   * The actions whose pages open for each user, among the ones asked about for
   * that user, by user id. Loads each action, user, and saved cohort decision
   * once for the batch; a cohort action still evaluates its live cohort per
   * member the saved decisions don't admit.
   */
  async openableActionIdsForUsers(params: {
    actionIdsByUser: ReadonlyMap<number, Iterable<number>>;
    now: Date;
  }): Promise<Map<number, Set<number>>> {
    const askedByUser = new Map(
      [...params.actionIdsByUser].map(([userId, ids]) => [
        userId,
        new Set(ids),
      ]),
    );
    const userIds = [...askedByUser.keys()];
    const askingIds = userIds.filter((userId) => askedByUser.get(userId)?.size);
    const actionIds = [
      ...new Set([...askedByUser.values()].flatMap((ids) => [...ids])),
    ];
    if (actionIds.length === 0) {
      return new Map(userIds.map((userId) => [userId, new Set()]));
    }

    const [users, actions] = await Promise.all([
      this.userRepository.find({
        where: { id: In(askingIds) },
        relations: ACTION_VISIBILITY_USER_RELATIONS,
        relationLoadStrategy: "query",
      }),
      this.loadActionsForVisibility(actionIds),
    ]);

    const session = new CohortResolutionSession();
    if (actions.some((action) => action.cohortExpression)) {
      await this.cohortAdmissionService.prefetchAdmittedActionIds(
        users.filter((user) => !user.admin).map((user) => user.id),
        session,
      );
    }
    const userById = new Map(users.map((user) => [user.id, user]));
    // One recipient at a time: a live cohort evaluation issues queries per
    // member, and the push dispatcher's batches would otherwise put hundreds
    // on the shared pool at once.
    const openable = new Map(
      userIds.map((userId) => [userId, new Set<number>()]),
    );
    for (const userId of askingIds) {
      openable.set(
        userId,
        await this.visibleActionIdsAmong({
          actions: actions.filter((action) =>
            askedByUser.get(userId)?.has(action.id),
          ),
          user: userById.get(userId) ?? null,
          session,
          now: params.now,
          allows: (access) => this.userCanOpenAction(access),
        }),
      );
    }
    return openable;
  }
}
