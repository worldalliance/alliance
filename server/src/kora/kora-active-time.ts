import { differenceInSeconds } from "date-fns";
import type { EntityManager } from "typeorm";
import { KoraAssignment } from "./entities/kora-assignment.entity";

/** A Kora review action's task is done at this much active time, once the current conversation is finished. */
export const KORA_ACTION_ACTIVE_SECONDS = 15 * 60;

/** The most one report may add; clients report about every 30 seconds. */
export const KORA_ACTIVE_REPORT_MAX_SECONDS = 60;

/** A report adds no more than the wall-clock time since the previous one, so a client can't inflate it. */
export function creditedSeconds(params: {
  reported: number;
  now: Date;
  lastReportedAt: Date | null;
}): number {
  const elapsed =
    params.lastReportedAt === null
      ? KORA_ACTIVE_REPORT_MAX_SECONDS
      : Math.max(0, differenceInSeconds(params.now, params.lastReportedAt));
  return Math.max(
    0,
    Math.min(
      Math.floor(params.reported),
      elapsed,
      KORA_ACTIVE_REPORT_MAX_SECONDS,
    ),
  );
}

export function actionTimeUp(assignment: {
  actionId: number | null;
  activeSeconds: number;
}): boolean {
  return (
    assignment.actionId !== null &&
    assignment.activeSeconds >= KORA_ACTION_ACTIVE_SECONDS
  );
}

export async function recordActiveTime(
  manager: EntityManager,
  params: { assignment: KoraAssignment; seconds: number },
): Promise<void> {
  const { assignment } = params;
  const now = new Date();
  const credited = creditedSeconds({
    reported: params.seconds,
    now,
    lastReportedAt: assignment.activeReportedAt,
  });
  await manager.update(
    KoraAssignment,
    { id: assignment.id },
    {
      activeSeconds: assignment.activeSeconds + credited,
      activeReportedAt: now,
    },
  );
}
