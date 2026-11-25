import { Features } from "@alliance/common/features";
import { KoraBatchEventKind, KoraReviewStatus } from "@alliance/common/kora";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { isFeatureEnabled } from "src/config/features";
import type { EntityManager } from "typeorm";
import { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import type { KoraReviewer } from "./entities/kora-reviewer.entity";
import { KORA_ACTION_REVIEWED, type KoraActionReviewed } from "./kora-events";
import { heldRows } from "./kora-pool";

export type KoraCompletion = {
  assignmentId: string;
  reviewerId: string;
  userId: number | null;
  actionId: number | null;
  ratingCount: number;
};

export function completionOf(params: {
  assignment: { id: string; actionId: number | null };
  reviewer: { id: string; userId: number | null };
  statuses: Iterable<KoraReviewStatus>;
}): KoraCompletion {
  return {
    assignmentId: params.assignment.id,
    reviewerId: params.reviewer.id,
    userId: params.reviewer.userId,
    actionId: params.assignment.actionId,
    ratingCount: [...params.statuses].filter((s) => s === KoraReviewStatus.Done)
      .length,
  };
}

/** Call inside the transaction that completes the assignment. */
export async function logCompletion(
  manager: EntityManager,
  completion: KoraCompletion,
): Promise<void> {
  if (!isFeatureEnabled(Features.KoraStagingTools)) return;
  await manager.insert(KoraBatchEvent, {
    kind: KoraBatchEventKind.AssignmentCompleted,
    assignmentId: completion.assignmentId,
    reviewerId: completion.reviewerId,
    ratingCount: completion.ratingCount,
  });
}

/** Call once that transaction commits; only an assignment started from an action completes it. */
export function emitActionReviewed(
  events: EventEmitter2,
  completion: KoraCompletion,
): void {
  if (completion.actionId === null || completion.userId === null) return;
  events.emit(KORA_ACTION_REVIEWED, {
    userId: completion.userId,
    actionId: completion.actionId,
  } satisfies KoraActionReviewed);
}

/**
 * Marks an assignment with nothing more to give finished, once none of its
 * transcripts is pending. Only one that holds a transcript credits the
 * member, as finishing it themselves would.
 */
export async function finishAssignment(
  manager: EntityManager,
  params: { assignment: KoraAssignment; reviewer: KoraReviewer },
): Promise<KoraCompletion | null> {
  const held = await heldRows(manager, params.assignment.id);
  if (held.some((r) => r.status === KoraReviewStatus.Pending)) return null;
  await manager.update(
    KoraAssignment,
    { id: params.assignment.id },
    { completedAt: new Date() },
  );
  const completion = completionOf({
    ...params,
    statuses: held.map((r) => r.status),
  });
  await logCompletion(manager, completion);
  return held.length > 0 ? completion : null;
}
