import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import type { Repository } from "typeorm";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";

/** Where a reader takes an action's cohort from. */
export enum CohortSource {
  /** Members the saved decisions admit. */
  Decisions = "decisions",
  /** The live cohort, recomputed from the expression and prerequisites. */
  Live = "live",
}

/** Reads of who the saved cohort decisions admit. */
@Injectable()
export class CohortAdmissionService {
  constructor(
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
  ) {}

  loadAdmittedActionIds(
    userId: number,
    session: CohortResolutionSession,
  ): Promise<Set<number>> {
    let pending = session.admittedActionIdsByUser.get(userId);
    if (!pending) {
      pending = this.decisionRepository
        .find({ where: { userId, included: true }, select: { actionId: true } })
        .then((rows) => new Set(rows.map((row) => row.actionId)));
      session.admittedActionIdsByUser.set(userId, pending);
    }
    return pending;
  }

  loadAdmittedMemberIds(
    actionId: number,
    session: CohortResolutionSession,
  ): Promise<Set<number>> {
    let pending = session.admittedUserIdsByAction.get(actionId);
    if (!pending) {
      pending = this.decisionRepository
        .find({ where: { actionId, included: true }, select: { userId: true } })
        .then((rows) => new Set(rows.map((row) => row.userId)));
      session.admittedUserIdsByAction.set(actionId, pending);
    }
    return pending;
  }
}
