import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { In, type Repository } from "typeorm";
import { TERMINAL_ACTIVITY_TYPES } from "./action-activity-status";
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

  /**
   * The members whose prerequisites have all resolved. A lone member, as when
   * reconciling a reader, reads only their own rows: one still waiting gets
   * no decision and is checked again on every read.
   */
  async filterReady<T extends { id: number }>(params: {
    action: Pick<Action, "prerequisiteActionIds">;
    users: T[];
    session: CohortResolutionSession;
    now: Date;
  }): Promise<T[]> {
    const { action, users, session, now } = params;
    const [user] = users;
    if (users.length === 1 && user) {
      const ready = await this.loadMemberReadiness({
        action,
        userId: user.id,
        session,
        now,
      });
      return ready ? users : [];
    }
    const isReady = await this.loadReadiness({ action, session, now });
    return users.filter((candidate) => isReady(candidate.id));
  }

  /** `loadReadiness` for one member, reading only their rows. */
  async loadMemberReadiness(params: {
    action: Pick<Action, "prerequisiteActionIds">;
    userId: number;
    session: CohortResolutionSession;
    now: Date;
  }): Promise<boolean> {
    const { action, userId, session, now } = params;
    const prerequisites = await Promise.all(
      action.prerequisiteActionIds.map((actionId) => {
        const key = `${userId}|${actionId}`;
        let pending = session.memberPrerequisiteProgress.get(key);
        if (!pending) {
          pending = this.loadOne(actionId, userId);
          session.memberPrerequisiteProgress.set(key, pending);
        }
        return pending;
      }),
    );
    return arePrerequisitesReady({ prerequisites, userId, now });
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

  private async loadOne(
    actionId: number,
    userId?: number,
  ): Promise<PrerequisiteProgress> {
    const [action, terminalUserIds, excluded] = await Promise.all([
      this.actionRepository.findOneOrFail({
        where: { id: actionId },
        relations: { events: true },
      }),
      this.loadTerminalUserIds(actionId, userId),
      this.decisionRepository.find({
        where: {
          actionId,
          included: false,
          ...(userId === undefined ? {} : { userId }),
        },
        select: { userId: true },
      }),
    ]);
    return {
      deadline: action.memberActionPhase.deadlineEvent?.date ?? null,
      terminalUserIds,
      excludedUserIds: new Set(excluded.map((row) => row.userId)),
    };
  }

  async loadTerminalUserIds(
    actionId: number,
    userId?: number,
  ): Promise<Set<number>> {
    const member = userId === undefined ? {} : { userId };
    const terminal = await this.actionActivityRepository.find({
      where: { actionId, type: In(TERMINAL_ACTIVITY_TYPES), ...member },
      select: { userId: true },
    });
    return new Set(terminal.map((a) => a.userId));
  }
}
