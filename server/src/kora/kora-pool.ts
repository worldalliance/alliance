import { KoraReviewStatus } from "@alliance/common/kora";
import type { EntityManager } from "typeorm";
import { KoraAssignmentTranscript } from "./entities/kora-assignment-transcript.entity";
import type { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import { type Candidate, pickNext } from "./kora-assignment-pick";

export const KORA_RELEASE_AFTER_HOURS = 24;

const RELEASE_WINDOW = `make_interval(hours => ${KORA_RELEASE_AFTER_HOURS})`;

/** Batch `b` is open: its transcripts can be given to reviewers. */
export const OPEN_BATCH = `b."retiredAt" IS NULL AND (b."closesAt" IS NULL OR b."closesAt" > now())`;

/**
 * Reviews counting toward transcript `t`'s target: finished ones, and pending
 * ones changed within the release window in assignments not yet closed.
 */
export const COUNTED_REVIEWS = `(
  SELECT COUNT(*)::int FROM "kora_assignment_transcript" at
  JOIN "kora_assignment" a ON a."id" = at."assignmentId"
  WHERE at."transcriptId" = t."id" AND a."deletedAt" IS NULL
    AND (at."status" = '${KoraReviewStatus.Done}' OR (at."status" = '${KoraReviewStatus.Pending}'
      AND a."completedAt" IS NULL
      AND at."lastActivityAt" > now() - ${RELEASE_WINDOW}
      AND (a."closesAt" IS NULL OR a."closesAt" > now())))
)`;

export type BatchCandidate = Candidate & { closesAt: Date | null };

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
 * Transcripts in open batches this reviewer hasn't had, released ones
 * included, outside the categories they opted out of, with how many reviews
 * each still needs.
 */
export async function candidates(
  manager: EntityManager,
  reviewerId: string,
): Promise<BatchCandidate[]> {
  const rows: BatchCandidate[] = await manager.query(
    `SELECT t."id", t."category", b."closesAt",
         b."reviewsPerTranscript" - ${COUNTED_REVIEWS} AS "deficit"
       FROM "kora_transcript" t
       JOIN "kora_batch" b ON b."id" = t."batchId"
       WHERE ${OPEN_BATCH} AND NOT EXISTS (
         SELECT 1 FROM "kora_assignment_transcript" mine
         JOIN "kora_assignment" a ON a."id" = mine."assignmentId"
         WHERE mine."transcriptId" = t."id" AND a."reviewerId" = $1
           AND a."deletedAt" IS NULL
       ) AND NOT EXISTS (
         SELECT 1 FROM "kora_reviewer" r
         WHERE r."id" = $1 AND t."category" = ANY(r."optOutCategories")
       )`,
    [reviewerId],
  );
  return rows.filter((r) => r.deficit > 0);
}

export function earliestClose(candidates: BatchCandidate[]): Date | null {
  return candidates.reduce<Date | null>(
    (earliest, c) =>
      c.closesAt && (!earliest || c.closesAt < earliest)
        ? c.closesAt
        : earliest,
    null,
  );
}

/** Releases the assignment's pending transcripts left unchanged past the window, returning their ids. */
export async function releaseExpired(
  manager: EntityManager,
  assignmentId: string,
): Promise<string[]> {
  const [rows]: [{ transcriptId: string }[], number] = await manager.query(
    `UPDATE "kora_assignment_transcript" SET "status" = $2
     WHERE "assignmentId" = $1 AND "status" = $3
       AND "lastActivityAt" <= now() - ${RELEASE_WINDOW}
     RETURNING "transcriptId"`,
    [assignmentId, KoraReviewStatus.Released, KoraReviewStatus.Pending],
  );
  return rows.map((r) => r.transcriptId);
}

/** The assignment's transcripts still in it, in the order they were given. */
export function heldRows(
  manager: EntityManager,
  assignmentId: string,
): Promise<KoraAssignmentTranscript[]> {
  return manager
    .createQueryBuilder(KoraAssignmentTranscript, "at")
    .innerJoinAndSelect("at.transcript", "t")
    .where(`at."assignmentId" = :assignmentId`, { assignmentId })
    .andWhere(`at."status" <> :released`, {
      released: KoraReviewStatus.Released,
    })
    .orderBy("at.position", "ASC")
    .getMany();
}

/**
 * The transcript the reviewer should review next: the pending one the
 * assignment holds, else a newly picked one while it has fewer than `size`,
 * else null. Run under the reviewer's lock.
 */
export async function bindNext(
  manager: EntityManager,
  params: { assignment: KoraAssignment; size: number },
): Promise<KoraTranscript | null> {
  const { assignment, size } = params;
  await releaseExpired(manager, assignment.id);
  const held = await heldRows(manager, assignment.id);
  const pending = held.find((r) => r.status === KoraReviewStatus.Pending);
  if (pending?.transcript) return pending.transcript;
  if (held.length >= size) return null;
  const picked = pickNext({
    candidates: await candidates(manager, assignment.reviewerId),
    bound: held.flatMap((r) => (r.transcript ? [r.transcript.category] : [])),
    random: Math.random,
  });
  if (!picked) return null;
  const position: number = (
    await manager.query(
      `SELECT COALESCE(MAX("position") + 1, 0)::int AS "next"
       FROM "kora_assignment_transcript" WHERE "assignmentId" = $1`,
      [assignment.id],
    )
  )[0].next;
  await manager.insert(KoraAssignmentTranscript, {
    assignmentId: assignment.id,
    transcriptId: picked.id,
    position,
    status: KoraReviewStatus.Pending,
  });
  return manager.findOneByOrFail(KoraTranscript, { id: picked.id });
}
