import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { CohortAdmissionService } from "./cohort-admission.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { ActionStatus } from "./entities/action-event.entity";
import {
  Action,
  actionStatusAt,
  loadedActionEvents,
  parseAction,
  type ParsedAction,
  VisibilityMode,
} from "./entities/action.entity";
import { SingleMemberCohortService } from "./single-member-cohort.service";
import { isStaffPreviewActiveFor } from "./staff-preview";
import { combinedSplitOf } from "./suite-split";

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
  /**
   * Judge an arm of a combined split by its own visibility, for feeds that show
   * it under the split's title. Its page opens only for members routed to it.
   */
  asSplit?: boolean;
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
    const { action, user, session, now = new Date(), asSplit } = params;
    if (user?.admin) {
      return true;
    }
    if (action.archived) {
      return false;
    }
    if (user && isStaffPreviewActiveFor({ user, action, now })) {
      return true;
    }
    if (
      actionStatusAt(loadedActionEvents(action), now) === ActionStatus.Draft
    ) {
      return false;
    }
    const routedOnly = !asSplit && combinedSplitOf(action) !== null;
    if (action.visibilityMode === VisibilityMode.Public && !routedOnly) {
      return true;
    }

    if (!user) {
      return false;
    }
    if (action.visibilityMode === VisibilityMode.AllMembers && !routedOnly) {
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

  /** The actions the user's action feed and search list: the ones they can see, less public-only ones. */
  async listableActions(params: {
    actions: ParsedAction[];
    user: User | null;
    session?: CohortResolutionSession;
  }): Promise<ParsedAction[]> {
    const listable = await this.visibleActionIdsAmong({
      actions: params.actions,
      user: params.user,
      session: params.session ?? new CohortResolutionSession(),
      allows: async (access) =>
        !access.action.publicOnly && (await this.userCanSeeAction(access)),
    });
    return params.actions.filter((action) => listable.has(action.id));
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
    /** False for items that show an arm as itself rather than as its split. */
    asSplit?: boolean;
  }): Promise<Set<number>> {
    const { asSplit = true } = params;
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
      allows: (access) => this.userCanSeeAction({ ...access, asSplit }),
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
