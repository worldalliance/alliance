import { KoraItemType, KoraReviewStatus } from "@alliance/common/kora";
import type { EntityManager } from "typeorm";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraConversation } from "./entities/kora-conversation.entity";
import { KoraSessionConversation } from "./entities/kora-session-conversation.entity";

export const KORA_RELEASE_AFTER_HOURS = 24;

const RELEASE_WINDOW = `make_interval(hours => ${KORA_RELEASE_AFTER_HOURS})`;

/** Batch `b` is open: its conversations can be served. */
export const OPEN_BATCH = `b."retiredAt" IS NULL AND (b."closesAt" IS NULL OR b."closesAt" > now())`;

/**
 * A conversation's coverage: its completed ratings plus the reservations still live — a session not
 * ended, within the release window, on a batch that hasn't closed. Two reviewers working at the same
 * moment therefore see different coverage and are not sent the same conversation (spec 6.0 section 7).
 */
/** A conversation's completed ratings, whatever is reserved on it now. */
export const COMPLETED = `(
  SELECT COUNT(*)::int FROM "kora_session_conversation" sc
  JOIN "kora_session" s ON s."id" = sc."sessionId"
  WHERE sc."conversationId" = c."id" AND s."deletedAt" IS NULL
    AND sc."status" = '${KoraReviewStatus.Done}'
)`;

export const COVERAGE = `(
  SELECT COUNT(*)::int FROM "kora_session_conversation" sc
  JOIN "kora_session" s ON s."id" = sc."sessionId"
  WHERE sc."conversationId" = c."id" AND s."deletedAt" IS NULL
    AND (sc."status" = '${KoraReviewStatus.Done}' OR (sc."status" = '${KoraReviewStatus.Pending}'
      AND s."endedAt" IS NULL
      AND sc."lastActivityAt" > now() - ${RELEASE_WINDOW}
      AND (s."closesAt" IS NULL OR s."closesAt" > now())))
)`;

export type Candidate = {
  id: string;
  riskId: string;
  nTurns: number;
  /** Completed ratings plus the reservations still live: what the ordering keys on. */
  coverage: number;
  /** Completed ratings alone: what says a conversation has had its share. */
  completed: number;
  /** Ratings this conversation is worth serving for, from its batch. */
  target: number;
  closesAt: Date | null;
};

export function newestOpenBatch(
  manager: EntityManager,
): Promise<KoraBatch | null> {
  return manager
    .createQueryBuilder(KoraBatch, "b")
    .where(OPEN_BATCH)
    .orderBy(`b."createdAt"`, "DESC")
    .getOne();
}

/**
 * Conversations of one item type this reviewer may be served now: in an open batch, never served to
 * them before, on a risk they have not opted out of, and short unless they opted in to longer ones.
 */
export async function candidates(
  manager: EntityManager,
  params: {
    reviewerId: string;
    extendedOptIn: boolean;
    itemType: KoraItemType;
  },
): Promise<Candidate[]> {
  return manager.query(
    `SELECT c."id", c."riskId", c."nTurns", b."closesAt",
         b."reviewsPerConversation" AS "target",
         ${COVERAGE} AS "coverage", ${COMPLETED} AS "completed"
       FROM "kora_conversation" c
       JOIN "kora_batch" b ON b."id" = c."batchId"
       WHERE ${OPEN_BATCH} AND c."itemType" = $2
         AND ($3 OR NOT c."optIn")
         AND NOT EXISTS (
           SELECT 1 FROM "kora_session_conversation" mine
           JOIN "kora_session" s ON s."id" = mine."sessionId"
           WHERE mine."conversationId" = c."id" AND s."reviewerId" = $1
             AND s."deletedAt" IS NULL
         ) AND NOT EXISTS (
           SELECT 1 FROM "kora_reviewer" r
           WHERE r."id" = $1 AND c."riskId" = ANY(r."optOutCategories")
         )`,
    [params.reviewerId, params.itemType, params.extendedOptIn],
  );
}

/** The risks this reviewer has already been served, so the queue can prefer one they haven't seen. */
export async function seenRisks(
  manager: EntityManager,
  reviewerId: string,
): Promise<Set<string>> {
  const rows: { riskId: string }[] = await manager.query(
    `SELECT DISTINCT c."riskId" FROM "kora_session_conversation" sc
       JOIN "kora_session" s ON s."id" = sc."sessionId"
       JOIN "kora_conversation" c ON c."id" = sc."conversationId"
       WHERE s."reviewerId" = $1 AND s."deletedAt" IS NULL`,
    [reviewerId],
  );
  return new Set(rows.map((r) => r.riskId));
}

/**
 * The conversation to serve next: the least covered of those still short of their ratings,
 * preferring a risk this reviewer has not met, ties at random (spec 6.0 section 7). Once nothing is
 * short, conversations that have had their share are served again, a fourth rating still being
 * useful — but never one another reviewer has open right now, which is why the first pass counts
 * reservations and the second counts only completed ratings.
 */
export function pickNext<C extends Candidate>(params: {
  candidates: C[];
  seenRisks: ReadonlySet<string>;
  random: () => number;
}): C | null {
  const short = params.candidates.filter((c) => c.coverage < c.target);
  const spare = params.candidates.filter((c) => c.completed >= c.target);
  const pool0 = short.length > 0 ? short : spare;
  if (pool0.length === 0) return null;
  const lowest = Math.min(...pool0.map((c) => c.coverage));
  const least = pool0.filter((c) => c.coverage === lowest);
  const fresh = least.filter((c) => !params.seenRisks.has(c.riskId));
  const pool = fresh.length > 0 ? fresh : least;
  return pool[Math.floor(params.random() * pool.length)] ?? null;
}

export function earliestClose(candidates: Candidate[]): Date | null {
  return candidates.reduce<Date | null>(
    (earliest, c) =>
      c.closesAt && (!earliest || c.closesAt < earliest)
        ? c.closesAt
        : earliest,
    null,
  );
}

/** Releases the session's reservations left unchanged past the window, returning their ids. */
export async function releaseExpired(
  manager: EntityManager,
  sessionId: string,
): Promise<string[]> {
  const [rows]: [{ conversationId: string }[], number] = await manager.query(
    `UPDATE "kora_session_conversation" SET "status" = $2
     WHERE "sessionId" = $1 AND "status" = $3
       AND "lastActivityAt" <= now() - ${RELEASE_WINDOW}
     RETURNING "conversationId"`,
    [sessionId, KoraReviewStatus.Released, KoraReviewStatus.Pending],
  );
  return rows.map((r) => r.conversationId);
}

/** The session's conversations still in it, in the order they were served. */
export function heldRows(
  manager: EntityManager,
  sessionId: string,
): Promise<KoraSessionConversation[]> {
  return manager
    .createQueryBuilder(KoraSessionConversation, "sc")
    .innerJoinAndSelect("sc.conversation", "c")
    .where(`sc."sessionId" = :sessionId`, { sessionId })
    .andWhere(`sc."status" <> :released`, {
      released: KoraReviewStatus.Released,
    })
    .orderBy("sc.position", "ASC")
    .getMany();
}

export function heldConversation(
  row: KoraSessionConversation,
): KoraConversation {
  if (!row.conversation)
    throw new Error(`Session row ${row.conversationId} has no conversation.`);
  return row.conversation;
}
