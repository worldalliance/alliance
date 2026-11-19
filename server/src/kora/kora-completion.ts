import { KoraBatchEventKind, KoraReviewStatus } from "@alliance/common/kora";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { EntityManager } from "typeorm";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KORA_MEMBER_REVIEWED, type KoraMemberReviewed } from "./kora-events";
import { koraStagingTools } from "./kora-staging-tools";

export type KoraCompletion = {
  sessionId: string;
  reviewerId: string;
  userId: number | null;
  /** Not the reviewer's first session; only the first credits a member's Kora action. */
  extra: boolean;
  ratingCount: number;
};

export function completionOf(params: {
  session: { id: string; number: number };
  reviewer: { id: string; userId: number | null };
  statuses: Iterable<KoraReviewStatus>;
}): KoraCompletion {
  return {
    sessionId: params.session.id,
    reviewerId: params.reviewer.id,
    userId: params.reviewer.userId,
    extra: params.session.number > 1,
    ratingCount: [...params.statuses].filter((s) => s === KoraReviewStatus.Done)
      .length,
  };
}

/** Call inside the transaction that ends the session. */
export async function logCompletion(
  manager: EntityManager,
  completion: KoraCompletion,
): Promise<void> {
  if (!koraStagingTools()) return;
  await manager.insert(KoraBatchEvent, {
    kind: KoraBatchEventKind.AssignmentCompleted,
    assignmentId: completion.sessionId,
    reviewerId: completion.reviewerId,
    ratingCount: completion.ratingCount,
  });
}

/** Call once that transaction commits; only a member's first session completes their Kora actions. */
export function emitMemberReviewed(
  events: EventEmitter2,
  completion: KoraCompletion,
): void {
  if (completion.extra || completion.userId === null) return;
  events.emit(KORA_MEMBER_REVIEWED, {
    userId: completion.userId,
  } satisfies KoraMemberReviewed);
}
