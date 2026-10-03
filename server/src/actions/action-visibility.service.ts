import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { CohortAdmissionService } from "./cohort-admission.service";
import { ActionStatus } from "./entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
  VisibilityMode,
} from "./entities/action.entity";
import { SingleMemberCohortService } from "./single-member-cohort.service";
import { isStaffPreviewActiveFor } from "./staff-preview";

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

  async userCanSeeAction(params: {
    action: ParsedAction;
    user: User | null;
    session?: CohortResolutionSession;
  }): Promise<boolean> {
    const { action, user, session } = params;
    if (user?.admin) {
      return true;
    }
    if (action.archived) {
      return false;
    }
    if (user && isStaffPreviewActiveFor({ user, action, now: new Date() })) {
      return true;
    }
    if (action.status === ActionStatus.Draft) {
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
      relations: { tags: true, contractEvents: true, awayRanges: true },
    });
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

    const actions = await this.actionRepository.find({
      where: { id: In(uniqueIds) },
      relations: { events: true },
    });

    const visible = new Set<number>();
    for (const raw of actions) {
      if (
        await this.userCanSeeAction({
          action: parseAction(raw),
          user,
          session,
        })
      ) {
        visible.add(raw.id);
      }
    }
    return visible;
  }
}
