import { KoraBatchEventKind, KoraReviewStatus } from "@alliance/common/kora";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { EntityManager } from "typeorm";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KORA_ACTION_REVIEWED, type KoraActionReviewed } from "./kora-events";
import { koraStagingTools } from "./kora-staging-tools";

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
  if (!koraStagingTools()) return;
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
