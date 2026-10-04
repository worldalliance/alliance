import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { In, type Repository } from "typeorm";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";

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

  /** Fills `loadAdmittedActionIds` for every listed member with one query. */
  async prefetchAdmittedActionIds(
    userIds: number[],
    session: CohortResolutionSession,
  ): Promise<void> {
    const missing = userIds.filter(
      (userId) => !session.admittedActionIdsByUser.has(userId),
    );
    if (missing.length === 0) {
      return;
    }
    const byUser = Map.groupBy(
      await this.decisionRepository.find({
        where: { userId: In(missing), included: true },
        select: { userId: true, actionId: true },
      }),
      (row) => row.userId,
    );
    for (const userId of missing) {
      session.admittedActionIdsByUser.set(
        userId,
        Promise.resolve(
          new Set((byUser.get(userId) ?? []).map((row) => row.actionId)),
        ),
      );
    }
  }

  /** Whether each action that decided the member includes them, by action id. */
  loadDecisionsForUser(
    userId: number,
    session: CohortResolutionSession,
  ): Promise<Map<number, boolean>> {
    let pending = session.decisionsByUser.get(userId);
    if (!pending) {
      pending = this.decisionRepository
        .find({ where: { userId }, select: { actionId: true, included: true } })
        .then(
          (rows) => new Map(rows.map((row) => [row.actionId, row.included])),
        );
      session.decisionsByUser.set(userId, pending);
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

  /** Whether each decided member is included, by member id. */
  loadDecisionsForAction(
    actionId: number,
    session: CohortResolutionSession,
  ): Promise<Map<number, boolean>> {
    let pending = session.decisionsByAction.get(actionId);
    if (!pending) {
      pending = this.decisionRepository
        .find({ where: { actionId }, select: { userId: true, included: true } })
        .then((rows) => new Map(rows.map((row) => [row.userId, row.included])));
      session.decisionsByAction.set(actionId, pending);
    }
    return pending;
  }
}
