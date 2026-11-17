import { KoraReviewStatus } from "@alliance/common/kora";

export const KORA_RELEASE_AFTER_DAYS = 7;

/** Batch `b` is open: its transcripts can be given to reviewers. */
export const OPEN_BATCH = `b."retiredAt" IS NULL AND (b."closesAt" IS NULL OR b."closesAt" > now())`;

/**
 * Reviews counting toward transcript `t`'s target: finished ones, and pending
 * ones in assignments saved within the release window and not yet closed.
 */
export const COUNTED_REVIEWS = `(
  SELECT COUNT(*)::int FROM "kora_assignment_transcript" at
  JOIN "kora_assignment" a ON a."id" = at."assignmentId"
  WHERE at."transcriptId" = t."id" AND a."deletedAt" IS NULL
    AND (at."status" = '${KoraReviewStatus.Done}' OR (at."status" = '${KoraReviewStatus.Pending}'
      AND a."completedAt" IS NULL
      AND a."lastActivityAt" > now() - make_interval(days => ${KORA_RELEASE_AFTER_DAYS})
      AND (a."closesAt" IS NULL OR a."closesAt" > now())))
)`;
