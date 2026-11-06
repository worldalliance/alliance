import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import type { CohortResolutionSession } from "./cohort-resolution-session";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";

type DecisionKey = keyof Pick<ActionCohortDecision, "userId" | "actionId">;

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
  prefetchAdmittedActionIds(
    userIds: number[],
    session: CohortResolutionSession,
  ): Promise<void> {
    return this.prefetchAdmitted({
      ids: userIds,
      by: "userId",
      collect: "actionId",
      memo: session.admittedActionIdsByUser,
    });
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

  /** Fills `loadAdmittedMemberIds` for every listed action with one query. */
  prefetchAdmittedMemberIds(
    actionIds: number[],
    session: CohortResolutionSession,
  ): Promise<void> {
    return this.prefetchAdmitted({
      ids: actionIds,
      by: "actionId",
      collect: "userId",
      memo: session.admittedUserIdsByAction,
    });
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

  private async prefetchAdmitted({
    ids,
    by,
    collect,
    memo,
  }: {
    ids: number[];
    by: DecisionKey;
    collect: DecisionKey;
    memo: Map<number, Promise<Set<number>>>;
  }): Promise<void> {
    const missing = ids.filter((id) => !memo.has(id));
    if (missing.length === 0) {
      return;
    }
    const rows = await this.decisionRepository.find({
      where: { [by]: In(missing), included: true },
      select: { userId: true, actionId: true },
    });
    const byKey = Map.groupBy(rows, (row) => row[by]);
    for (const id of missing) {
      memo.set(
        id,
        Promise.resolve(
          new Set((byKey.get(id) ?? []).map((row) => row[collect])),
        ),
      );
    }
  }
}
