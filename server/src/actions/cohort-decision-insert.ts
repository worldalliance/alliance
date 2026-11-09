import { lockLiveIds } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { EntityManager } from "typeorm";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { Action } from "./entities/action.entity";
import { liveAssignments } from "./new-assignment";

const INSERT_CHUNK_SIZE = 1000;

export type DecisionRow = Pick<
  ActionCohortDecision,
  "actionId" | "userId" | "included" | "reason" | "resolvedAt"
> & { branchId: number | null };

/**
 * All or nothing, so a later pass never skips a half-backfilled action. A
 * concurrent writer's row wins; decisions are final once written. Rows for
 * an action or account deleted since the pass loaded them are dropped.
 */
export async function insertDecisions(
  em: EntityManager,
  rows: DecisionRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await em.transaction(async (manager) => {
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
        .values(
          live
            .slice(i, i + INSERT_CHUNK_SIZE)
            .map(({ branchId: _, ...decision }) => decision),
        )
        .orIgnore()
        .execute();
    }
    const assignments = await liveAssignments(
      manager,
      live.flatMap(({ actionId, userId, branchId }) =>
        branchId === null
          ? []
          : [{ actionId, userId, variantId: null, branchId }],
      ),
    );
    for (let i = 0; i < assignments.length; i += INSERT_CHUNK_SIZE) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(ActionFormAssignment)
        .values(assignments.slice(i, i + INSERT_CHUNK_SIZE))
        .orIgnore()
        .execute();
    }
  });
}
