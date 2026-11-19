import {
  KoraItemType,
  KoraReviewStatus,
  KoraSessionEnd,
} from "@alliance/common/kora";
import type { KoraItem } from "@alliance/kora-review";
import type { EntityManager } from "typeorm";
import { KoraConversation } from "./entities/kora-conversation.entity";
import type { KoraReviewer } from "./entities/kora-reviewer.entity";
import { KoraSessionConversation } from "./entities/kora-session-conversation.entity";
import type { KoraSession } from "./entities/kora-session.entity";
import { koraItem } from "./kora-item";
import {
  type Candidate,
  candidates,
  heldConversation,
  heldRows,
  pickNext,
  releaseExpired,
  seenRisks,
} from "./kora-queue";
import {
  attentionDue,
  fits,
  type HeldItem,
  isRated,
  practiceDue,
  ratedCount,
} from "./kora-serve";
import { koraStagingTools } from "./kora-staging-tools";

/** What the tool's `next` resolves to: one conversation, or why there isn't one. */
export type KoraNextResult = { item: KoraItem } | { done: KoraSessionEnd };

/**
 * The conversation a session should show next, reserved for the reviewer: the one it already holds
 * unfinished, else practice, else the attention conversation when it is due, else the least covered
 * conversation the reviewer may see. Runs inside the caller's transaction, under the reviewer's lock.
 */
export async function serveNext(
  manager: EntityManager,
  params: { session: KoraSession; reviewer: KoraReviewer },
): Promise<KoraNextResult> {
  const { session, reviewer } = params;
  await releaseExpired(manager, session.id);
  const held = await heldRows(manager, session.id);
  const pending = held.find((r) => r.status === KoraReviewStatus.Pending);
  if (pending) {
    return {
      item: koraItem({
        conversation: heldConversation(pending),
        ratedPosition: pending.ratedPosition,
        firstTimeOnRisk: pending.firstTimeOnRisk,
      }),
    };
  }
  const heldItems: HeldItem[] = held.map((row) => ({
    itemType: heldConversation(row).itemType,
    nTurns: heldConversation(row).nTurns,
  }));
  const risks = await seenRisks(manager, reviewer.id);
  const practice = practiceDue({
    sessionNumber: session.number,
    practiceServed: await servedCount(
      manager,
      reviewer.id,
      KoraItemType.Practice,
    ),
  });
  // An import with no practice conversations, such as a test batch, goes straight to the rated ones.
  const conversation =
    (practice === null
      ? null
      : await practiceConversation(manager, practice)) ??
    (await ratedConversation(manager, {
      reviewer,
      session,
      held: heldItems,
      risks,
    }));
  if (!conversation) return { done: await endReason(manager, reviewer) };

  const row = await manager.save(KoraSessionConversation, {
    sessionId: session.id,
    conversationId: conversation.id,
    position: held.length,
    ratedPosition: isRated(conversation.itemType)
      ? ratedCount(heldItems) + 1
      : null,
    firstTimeOnRisk: !risks.has(conversation.riskId),
    status: KoraReviewStatus.Pending,
    lastActivityAt: new Date(),
  });
  return {
    item: koraItem({
      conversation,
      ratedPosition: row.ratedPosition,
      firstTimeOnRisk: row.firstTimeOnRisk,
    }),
  };
}

/**
 * What a session serves as a rated conversation, scored first. KORA's test
 * corpus is servable everywhere but production, so the platform can be
 * exercised on real content before the review set arrives (spec 6.0 section
 * 11); Annex D keeps ratings on it out of the export.
 */
const ratedTypes = (): KoraItemType[] =>
  koraStagingTools()
    ? [KoraItemType.Scored, KoraItemType.Test]
    : [KoraItemType.Scored];

/** Everything servable as a rated conversation, taking the types in priority order. */
export async function ratedCandidates(
  manager: EntityManager,
  reviewer: Pick<KoraReviewer, "id" | "extendedOptIn">,
): Promise<Candidate[]> {
  for (const itemType of ratedTypes()) {
    const available = await candidates(manager, {
      reviewerId: reviewer.id,
      extendedOptIn: reviewer.extendedOptIn,
      itemType,
    });
    if (available.length > 0) return available;
  }
  return [];
}

/** Nothing to serve: the budget stopped the session, unless nothing eligible was left anyway. */
async function endReason(
  manager: EntityManager,
  reviewer: KoraReviewer,
): Promise<KoraSessionEnd> {
  return (await ratedCandidates(manager, reviewer)).length === 0
    ? KoraSessionEnd.QueueEmpty
    : KoraSessionEnd.BudgetSpent;
}

/** The two practice conversations are the same for everyone, in import order. */
function practiceConversation(manager: EntityManager, index: number) {
  return manager
    .createQueryBuilder(KoraConversation, "c")
    .innerJoin("c.batch", "b")
    .where(`c."itemType" = :practice`, { practice: KoraItemType.Practice })
    .andWhere(`b."retiredAt" IS NULL`)
    .orderBy(`c."position"`, "ASC")
    .offset(index)
    .limit(1)
    .getOne();
}

/** The attention conversation when it is due, else the least covered one the reviewer may see. */
async function ratedConversation(
  manager: EntityManager,
  params: {
    reviewer: KoraReviewer;
    session: KoraSession;
    held: HeldItem[];
    risks: ReadonlySet<string>;
  },
): Promise<KoraConversation | null> {
  const { reviewer, session, held, risks } = params;
  const wantsAttention = attentionDue({
    sessionNumber: session.number,
    held,
    attentionServedBefore:
      (await servedCount(manager, reviewer.id, KoraItemType.Attention)) > 0,
    reviewerId: reviewer.id,
  });
  const itemTypes = wantsAttention
    ? [KoraItemType.Attention, ...ratedTypes()]
    : ratedTypes();
  for (const itemType of itemTypes) {
    const available = await candidates(manager, {
      reviewerId: reviewer.id,
      extendedOptIn: reviewer.extendedOptIn,
      itemType,
    });
    const picked = pickNext({
      candidates: available,
      seenRisks: risks,
      random: Math.random,
    });
    if (!picked) continue;
    if (
      !fits({ held, nTurns: picked.nTurns, budgetUnits: session.budgetUnits })
    ) {
      return null;
    }
    return manager.findOneByOrFail(KoraConversation, { id: picked.id });
  }
  return null;
}

/** Conversations of one item type this reviewer has been given, across every session of theirs. */
async function servedCount(
  manager: EntityManager,
  reviewerId: string,
  itemType: KoraItemType,
): Promise<number> {
  const rows: { count: string }[] = await manager.query(
    `SELECT COUNT(*) AS "count" FROM "kora_session_conversation" sc
       JOIN "kora_session" s ON s."id" = sc."sessionId"
       JOIN "kora_conversation" c ON c."id" = sc."conversationId"
       WHERE s."reviewerId" = $1 AND s."deletedAt" IS NULL
         AND c."itemType" = $2 AND sc."status" <> $3`,
    [reviewerId, itemType, KoraReviewStatus.Released],
  );
  return Number(rows[0]?.count ?? 0);
}
