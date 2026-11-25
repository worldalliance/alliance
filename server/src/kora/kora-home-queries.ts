import { KoraReviewStatus } from "@alliance/common/kora";
import type { EntityManager } from "typeorm";
import type { KoraAssignmentProgress, KoraOffer } from "./kora-home";
import { candidates, earliestClose, newestOpenBatch } from "./kora-pool";

/** Reads only: an offer reserves nothing until `more` starts it. */
export async function koraOffer(
  manager: EntityManager,
  reviewerId: string,
): Promise<KoraOffer | null> {
  const newest = await newestOpenBatch(manager);
  if (!newest) return null;
  const available = await candidates(manager, reviewerId);
  if (available.length === 0) return null;
  return {
    releasedAt: newest.createdAt,
    closesAt: earliestClose(available),
    size: Math.min(newest.transcriptsPerAssignment, available.length),
  };
}

export function koraProgress(
  manager: EntityManager,
  reviewerId: string,
): Promise<KoraAssignmentProgress[]> {
  return manager.query(
    `SELECT a."id", a."createdAt", a."closesAt", a."completedAt",
       MAX(b."createdAt") AS "releasedAt",
       CASE WHEN a."completedAt" IS NULL THEN MAX(sb."transcriptsPerAssignment")
         ELSE COUNT(at."transcriptId") FILTER (WHERE at."status" <> $4) END::int AS "total",
       COUNT(at."transcriptId") FILTER (WHERE at."status" NOT IN ($2, $4))::int AS "progress",
       COUNT(at."transcriptId") FILTER (WHERE at."status" = $3)::int AS "ranked"
     FROM "kora_assignment" a
     JOIN "kora_batch" sb ON sb."id" = a."schemaBatchId"
     LEFT JOIN "kora_assignment_transcript" at ON at."assignmentId" = a."id"
     LEFT JOIN "kora_transcript" t ON t."id" = at."transcriptId"
     LEFT JOIN "kora_batch" b ON b."id" = t."batchId"
     WHERE a."reviewerId" = $1 AND a."deletedAt" IS NULL
     GROUP BY a."id"`,
    [
      reviewerId,
      KoraReviewStatus.Pending,
      KoraReviewStatus.Done,
      KoraReviewStatus.Released,
    ],
  );
}
