import { KoraBatchEventKind, KoraReviewStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "src/utils/Repository";
import { DataSource, type EntityManager, In } from "typeorm";
import { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import type { KoraBatchSummary } from "./kora-batch.service";
import {
  emitMemberReviewed,
  type KoraCompletion,
  logCompletion,
} from "./kora-completion";

export type KoraActor = { id: number; name: string };

export type KoraDeletionImpact = {
  transcriptCount: number;
  ratingCount: number;
  assignmentCount: number;
};

export type KoraLoggedEvent = {
  event: KoraBatchEvent;
  assignmentDeleted: boolean;
};

export enum KoraBatchActionError {
  NotFound = "not_found",
}

type BatchResult<T> = Result<T, KoraBatchActionError>;

@Injectable()
export class KoraBatchActionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraBatchEvent)
    private readonly events: Repository<KoraBatchEvent>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly emitter: EventEmitter2,
  ) {}

  async actor(userId: number): Promise<KoraActor> {
    const user = await this.users.findOneByOrFail({ id: userId });
    return { id: user.id, name: user.name };
  }

  async list(): Promise<KoraLoggedEvent[]> {
    const events = await this.events.find({ order: { createdAt: "DESC" } });
    const assignmentIds = events.flatMap((e) =>
      e.assignmentId ? [e.assignmentId] : [],
    );
    const live = assignmentIds.length
      ? await this.dataSource.manager.find(KoraAssignment, {
          where: { id: In(assignmentIds) },
          select: { id: true },
        })
      : [];
    const liveIds = new Set(live.map((a) => a.id));
    return events.map((event) => ({
      event,
      assignmentDeleted:
        event.assignmentId !== null && !liveIds.has(event.assignmentId),
    }));
  }

  /** Unrated transcripts leave unfinished assignments, which complete if nothing is left to rate. */
  retire(params: {
    batchId: string;
    actor: KoraActor;
  }): Promise<BatchResult<KoraBatchSummary>> {
    return this.completing<BatchResult<KoraBatchSummary>>(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return none(R.failure(KoraBatchActionError.NotFound));
      const transcriptCount = await countTranscripts(manager, batch.id);
      if (batch.retiredAt) return none(R.success({ batch, transcriptCount }));
      batch.retiredAt = new Date();
      await manager.update(
        KoraBatch,
        { id: batch.id },
        { retiredAt: batch.retiredAt },
      );
      const completed = await completeEmptied(
        manager,
        await dropUnrated(manager, batch.id),
      );
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Retire,
        batch,
        actor: params.actor,
        counts: { transcriptCount },
      });
      return { result: R.success({ batch, transcriptCount }), completed };
    });
  }

  reactivate(params: {
    batchId: string;
    actor: KoraActor;
  }): Promise<BatchResult<KoraBatchSummary>> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return R.failure(KoraBatchActionError.NotFound);
      const transcriptCount = await countTranscripts(manager, batch.id);
      if (!batch.retiredAt) return R.success({ batch, transcriptCount });
      batch.retiredAt = null;
      await manager.update(KoraBatch, { id: batch.id }, { retiredAt: null });
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Reactivate,
        batch,
        actor: params.actor,
        counts: { transcriptCount },
      });
      return R.success({ batch, transcriptCount });
    });
  }

  async deletionImpact(
    batchId: string,
  ): Promise<BatchResult<KoraDeletionImpact>> {
    const batch = await this.dataSource.manager.findOneBy(KoraBatch, {
      id: batchId,
    });
    if (!batch) return R.failure(KoraBatchActionError.NotFound);
    return R.success(await impactOf(this.dataSource.manager, batchId));
  }

  /** Removes the batch, its transcripts and their ratings, and every assignment checked against its schema. */
  delete(params: {
    batchId: string;
    actor: KoraActor;
  }): Promise<BatchResult<KoraDeletionImpact>> {
    return this.completing<BatchResult<KoraDeletionImpact>>(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return none(R.failure(KoraBatchActionError.NotFound));
      const impact = await impactOf(manager, batch.id);
      const touched = await dropUnrated(manager, batch.id);
      await manager.delete(KoraBatch, { id: batch.id });
      const completed = await completeEmptied(manager, touched);
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Delete,
        batch,
        actor: params.actor,
        counts: impact,
      });
      return { result: R.success(impact), completed };
    });
  }

  private async completing<T>(
    work: (manager: EntityManager) => Promise<Completing<T>>,
  ): Promise<T> {
    const { result, completed } = await this.dataSource.transaction(work);
    for (const completion of completed) {
      emitMemberReviewed(this.emitter, completion);
    }
    return result;
  }
}

type Completing<T> = { result: T; completed: KoraCompletion[] };

const none = <T>(result: T): Completing<T> => ({ result, completed: [] });

export function logBatchEvent(
  manager: EntityManager,
  params: {
    kind: KoraBatchEventKind;
    batch: KoraBatch;
    actor: KoraActor;
    counts: Partial<KoraDeletionImpact>;
  },
): Promise<unknown> {
  return manager.insert(KoraBatchEvent, {
    kind: params.kind,
    batchId: params.batch.id,
    batchUploadedAt: params.batch.createdAt,
    transcriptCount: params.counts.transcriptCount ?? null,
    ratingCount: params.counts.ratingCount ?? null,
    assignmentCount: params.counts.assignmentCount ?? null,
    adminId: params.actor.id,
    adminName: params.actor.name,
  });
}

const countTranscripts = (manager: EntityManager, batchId: string) =>
  manager.countBy(KoraTranscript, { batchId });

async function dropUnrated(
  manager: EntityManager,
  batchId: string,
): Promise<string[]> {
  const [rows]: [{ assignmentId: string }[], number] = await manager.query(
    `DELETE FROM "kora_assignment_transcript" at
     USING "kora_assignment" a, "kora_transcript" t
     WHERE at."assignmentId" = a."id" AND at."transcriptId" = t."id"
       AND t."batchId" = $1 AND at."status" = $2
       AND a."completedAt" IS NULL AND a."deletedAt" IS NULL
     RETURNING at."assignmentId"`,
    [batchId, KoraReviewStatus.Pending],
  );
  return [...new Set(rows.map((r) => r.assignmentId))];
}

/**
 * Completes the assignments left with nothing to rate. Only those that still
 * hold a transcript the reviewer rated or opted out of credit the member, as
 * finishing it themselves would.
 */
async function completeEmptied(
  manager: EntityManager,
  assignmentIds: string[],
): Promise<KoraCompletion[]> {
  if (assignmentIds.length === 0) return [];
  const [rows]: [(KoraCompletion & { reviewed: boolean })[], number] =
    await manager.query(
      `UPDATE "kora_assignment" a SET "completedAt" = now()
       FROM "kora_reviewer" r
       WHERE r."id" = a."reviewerId"
         AND a."id" = ANY($1) AND a."completedAt" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM "kora_assignment_transcript" at
           WHERE at."assignmentId" = a."id" AND at."status" = $2
         )
       RETURNING a."id" AS "assignmentId", a."reviewerId", r."userId", a."extra",
         (SELECT COUNT(*)::int FROM "kora_assignment_transcript" at
          WHERE at."assignmentId" = a."id" AND at."status" = $3) AS "ratingCount",
         EXISTS (SELECT 1 FROM "kora_assignment_transcript" at
          WHERE at."assignmentId" = a."id") AS "reviewed"`,
      [assignmentIds, KoraReviewStatus.Pending, KoraReviewStatus.Done],
    );
  for (const row of rows) await logCompletion(manager, row);
  return rows.flatMap(({ reviewed, ...completion }) =>
    reviewed ? [completion] : [],
  );
}

async function impactOf(
  manager: EntityManager,
  batchId: string,
): Promise<KoraDeletionImpact> {
  const [row]: KoraDeletionImpact[] = await manager.query(
    `SELECT
       (SELECT COUNT(*)::int FROM "kora_transcript" WHERE "batchId" = $1)
         AS "transcriptCount",
       (SELECT COUNT(*)::int FROM "kora_assignment_transcript" at
          JOIN "kora_assignment" a ON a."id" = at."assignmentId"
          JOIN "kora_transcript" t ON t."id" = at."transcriptId"
          WHERE at."status" = $2 AND a."deletedAt" IS NULL
            AND (t."batchId" = $1 OR a."schemaBatchId" = $1))
         AS "ratingCount",
       (SELECT COUNT(*)::int FROM "kora_assignment"
          WHERE "schemaBatchId" = $1 AND "deletedAt" IS NULL)
         AS "assignmentCount"`,
    [batchId, KoraReviewStatus.Done],
  );
  return row;
}
