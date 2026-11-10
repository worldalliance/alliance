import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { lockLiveIds } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { ActionCohortDecisionCorrection } from "./entities/action-cohort-decision-correction.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { Action, type ParsedAction } from "./entities/action.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";

const INSERT_CHUNK_SIZE = 1000;

export type DecisionRow = Pick<
  ActionCohortDecision,
  "actionId" | "userId" | "included" | "reason" | "resolvedAt"
>;

@Injectable()
export class CohortDecisionStoreService {
  constructor(
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
    @InjectRepository(ActionCohortDecisionCorrection)
    private readonly correctionRepository: Repository<ActionCohortDecisionCorrection>,
  ) {}

  /**
   * When the resolver first ran: its earliest ordinary decision, counting one
   * staff have since corrected.
   */
  async findCutover(): Promise<Date | null> {
    const ordinary = In([
      CohortDecisionReason.Launch,
      CohortDecisionReason.Signing,
      CohortDecisionReason.PrerequisitesResolved,
    ]);
    const [decision, correction] = await Promise.all([
      this.decisionRepository.findOne({
        where: { reason: ordinary },
        order: { resolvedAt: "ASC" },
        select: { resolvedAt: true },
      }),
      this.correctionRepository.findOne({
        where: { previousReason: ordinary },
        order: { previousResolvedAt: "ASC" },
        select: { previousResolvedAt: true },
      }),
    ]);
    const times = [decision?.resolvedAt, correction?.previousResolvedAt].filter(
      (time) => time !== undefined,
    );
    return times.length === 0
      ? null
      : new Date(Math.min(...times.map((time) => time.getTime())));
  }

  async loadDecidedActionIds(
    userId: number,
    open: Array<{ action: ParsedAction }>,
  ): Promise<Set<number>> {
    if (open.length === 0) return new Set();
    const rows = await this.decisionRepository.find({
      where: {
        userId,
        actionId: In(open.map(({ action }) => action.id)),
      },
      select: { actionId: true },
    });
    return new Set(rows.map((row) => row.actionId));
  }

  async findActionIdsWithDecisions(actionIds: number[]): Promise<Set<number>> {
    if (actionIds.length === 0) return new Set();
    const rows = await this.decisionRepository
      .createQueryBuilder("decision")
      .select('DISTINCT decision."actionId"', "actionId")
      .where('decision."actionId" IN (:...actionIds)', { actionIds })
      .getRawMany<{ actionId: number }>();
    return new Set(rows.map((row) => row.actionId));
  }

  /** A member decided on any arm of a split counts as decided on all of them. */
  async findDecidedUserIds(
    actionIds: number[],
    options: {
      onlyUserId?: number;
      splitIds?: ReadonlyMap<number, number>;
    } = {},
  ): Promise<Map<number, Set<number>>> {
    const { onlyUserId, splitIds } = options;
    const rows = await this.decisionRepository.find({
      where: {
        actionId: In(actionIds),
        ...(onlyUserId === undefined ? {} : { userId: onlyUserId }),
      },
      select: { actionId: true, userId: true },
    });
    const key = (actionId: number) => {
      const splitId = splitIds?.get(actionId);
      return splitId === undefined ? `action:${actionId}` : `split:${splitId}`;
    };
    const byKey = new Map<string, Set<number>>();
    for (const { actionId, userId } of rows) {
      let userIds = byKey.get(key(actionId));
      if (!userIds) {
        userIds = new Set();
        byKey.set(key(actionId), userIds);
      }
      userIds.add(userId);
    }
    return new Map(
      actionIds.flatMap((actionId) => {
        const userIds = byKey.get(key(actionId));
        return userIds ? [[actionId, userIds] as const] : [];
      }),
    );
  }

  /**
   * All or nothing, so a later pass never skips a half-backfilled action. A
   * concurrent writer's row wins; decisions are final once written. Rows for
   * an action or account deleted since the pass loaded them are dropped.
   */
  async insert(rows: DecisionRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.decisionRepository.manager.transaction(async (manager) => {
      const liveActionIds = await lockLiveIds(manager, {
        target: Action,
        ids: [...new Set(rows.map((row) => row.actionId))],
      });
      const liveUserIds = await lockLiveIds(manager, {
        target: User,
        ids: [...new Set(rows.map((row) => row.userId))],
      });
      const live = rows.filter(
        (row) => liveActionIds.has(row.actionId) && liveUserIds.has(row.userId),
      );
      for (let i = 0; i < live.length; i += INSERT_CHUNK_SIZE) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(ActionCohortDecision)
          .values(live.slice(i, i + INSERT_CHUNK_SIZE))
          .orIgnore()
          .execute();
      }
    });
  }
}
