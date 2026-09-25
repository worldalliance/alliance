import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import type { Repository } from "typeorm";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { Action } from "./entities/action.entity";
import {
  arePrerequisitesReady,
  type PrerequisiteProgress,
} from "./prerequisites";

@Injectable()
export class PrerequisiteProgressService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
  ) {}

  /**
   * Whether a member's prerequisites for the action have all resolved. One
   * still waiting gets no decision until they do.
   */
  async loadReadiness(params: {
    action: Pick<Action, "prerequisiteActionIds">;
    session: CohortResolutionSession;
    now: Date;
  }): Promise<(userId: number) => boolean> {
    const { action, session, now } = params;
    if (action.prerequisiteActionIds.length === 0) return () => true;
    const prerequisites = await this.load(
      action.prerequisiteActionIds,
      session,
    );
    return (userId) => arePrerequisitesReady({ prerequisites, userId, now });
  }

  private load(
    actionIds: number[],
    session: CohortResolutionSession,
  ): Promise<PrerequisiteProgress[]> {
    return Promise.all(
      actionIds.map((actionId) => {
        let pending = session.prerequisiteProgress.get(actionId);
        if (!pending) {
          pending = this.loadOne(actionId);
          session.prerequisiteProgress.set(actionId, pending);
        }
        return pending;
      }),
    );
  }

  private async loadOne(actionId: number): Promise<PrerequisiteProgress> {
    const [action, terminalUserIds, excluded] = await Promise.all([
      this.actionRepository.findOneOrFail({
        where: { id: actionId },
        relations: { events: true },
      }),
      this.loadTerminalUserIds(actionId),
      this.decisionRepository.find({
        where: { actionId, included: false },
        select: { userId: true },
      }),
    ]);
    return {
      deadline: action.memberActionPhase.deadlineEvent?.date ?? null,
      terminalUserIds,
      excludedUserIds: new Set(excluded.map((row) => row.userId)),
    };
  }

  async loadTerminalUserIds(actionId: number): Promise<Set<number>> {
    const terminal = await this.actionActivityRepository.find({
      where: [
        { actionId, type: ActionActivityType.USER_COMPLETED },
        { actionId, type: ActionActivityType.USER_WONT_COMPLETE },
      ],
      select: { userId: true },
    });
    return new Set(terminal.map((a) => a.userId));
  }
}
