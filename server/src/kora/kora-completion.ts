import { KoraBatchEventKind } from "@alliance/common/kora";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { EntityManager } from "typeorm";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KORA_MEMBER_REVIEWED, type KoraMemberReviewed } from "./kora-events";
import { koraStagingTools } from "./kora-staging-tools";

export type KoraCompletion = {
  assignmentId: string;
  reviewerId: string;
  userId: number | null;
  extra: boolean;
  ratingCount: number;
};

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

/** Call once that transaction commits; only a member's first assignment completes their Kora actions. */
export function emitMemberReviewed(
  events: EventEmitter2,
  completion: KoraCompletion,
): void {
  if (completion.extra || completion.userId === null) return;
  events.emit(KORA_MEMBER_REVIEWED, {
    userId: completion.userId,
  } satisfies KoraMemberReviewed);
}
