import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  type FindOptionsSelect,
  type FindOptionsWhere,
  In,
  type Repository,
} from "typeorm";
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

  /**
   * The actions whose decision admits the member as optional work: a partition
   * part's grid row can make an action optional for some members only.
   */
  loadOptionalRowActionIds(
    userId: number,
    session: CohortResolutionSession,
  ): Promise<Set<number>> {
    let pending = session.optionalRowActionIdsByUser.get(userId);
    if (!pending) {
      pending = this.decisionRepository
        .find({
          where: { userId, included: true, optional: true },
          select: { actionId: true },
        })
        .then((rows) => new Set(rows.map((row) => row.actionId)));
      session.optionalRowActionIdsByUser.set(userId, pending);
    }
    return pending;
  }

  /** Members each action admits as optional work, by action id. */
  async loadOptionalRowMemberIds(
    actionIds: number[],
  ): Promise<Map<number, Set<number>>> {
    const byAction = new Map(actionIds.map((id) => [id, new Set<number>()]));
    if (actionIds.length === 0) return byAction;
    const rows = await this.decisionRepository.find({
      where: { actionId: In(actionIds), included: true, optional: true },
      select: { actionId: true, userId: true },
    });
    for (const { actionId, userId } of rows)
      byAction.get(actionId)?.add(userId);
    return byAction;
  }

  /** Fills `loadAdmittedActionIds` for every listed member with one query. */
  prefetchAdmittedActionIds(
    userIds: number[],
    session: CohortResolutionSession,
  ): Promise<void> {
    return this.prefetch({
      ids: userIds,
      by: "userId",
      where: { included: true },
      select: { userId: true, actionId: true },
      memo: session.admittedActionIdsByUser,
      build: (rows) => new Set(rows.map((row) => row.actionId)),
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
    return this.prefetch({
      ids: actionIds,
      by: "actionId",
      where: { included: true },
      select: { userId: true, actionId: true },
      memo: session.admittedUserIdsByAction,
      build: (rows) => new Set(rows.map((row) => row.userId)),
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

  /** Fills `loadDecisionsForAction` for every listed action with one query. */
  prefetchDecisionsForActions(
    actionIds: number[],
    session: CohortResolutionSession,
  ): Promise<void> {
    return this.prefetch({
      ids: actionIds,
      by: "actionId",
      select: { actionId: true, userId: true, included: true },
      memo: session.decisionsByAction,
      build: (rows) => new Map(rows.map((row) => [row.userId, row.included])),
    });
  }

  private async prefetch<V>({
    ids,
    by,
    where = {},
    select,
    memo,
    build,
  }: {
    ids: number[];
    by: DecisionKey;
    where?: FindOptionsWhere<ActionCohortDecision>;
    select: FindOptionsSelect<ActionCohortDecision>;
    memo: Map<number, Promise<V>>;
    build: (rows: ActionCohortDecision[]) => V;
  }): Promise<void> {
    const missing = ids.filter((id) => !memo.has(id));
    if (missing.length === 0) {
      return;
    }
    const rows = await this.decisionRepository.find({
      where: { [by]: In(missing), ...where },
      select,
    });
    const byKey = Map.groupBy(rows, (row) => row[by]);
    for (const id of missing) {
      memo.set(id, Promise.resolve(build(byKey.get(id) ?? [])));
    }
  }
}
