import { KoraBatchEventKind, KoraReviewStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "src/utils/Repository";
import { DataSource, type EntityManager, In } from "typeorm";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraConversation } from "./entities/kora-conversation.entity";
import { KoraSession } from "./entities/kora-session.entity";
import type { KoraBatchSummary } from "./kora-batch.service";

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
      ? await this.dataSource.manager.find(KoraSession, {
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

  /** Unrated transcripts leave unfinished assignments, which are given others in their place. */
  retire(params: {
    batchId: string;
    actor: KoraActor;
  }): Promise<BatchResult<KoraBatchSummary>> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return R.failure(KoraBatchActionError.NotFound);
      const conversationCount = await countConversations(manager, batch.id);
      if (batch.retiredAt) return R.success({ batch, conversationCount });
      batch.retiredAt = new Date();
      await manager.update(
        KoraBatch,
        { id: batch.id },
        { retiredAt: batch.retiredAt },
      );
      await dropUnrated(manager, batch.id);
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Retire,
        batch,
        actor: params.actor,
        counts: { transcriptCount: conversationCount },
      });
      return R.success({ batch, conversationCount });
    });
  }

  reactivate(params: {
    batchId: string;
    actor: KoraActor;
  }): Promise<BatchResult<KoraBatchSummary>> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return R.failure(KoraBatchActionError.NotFound);
      const conversationCount = await countConversations(manager, batch.id);
      if (!batch.retiredAt) return R.success({ batch, conversationCount });
      batch.retiredAt = null;
      await manager.update(KoraBatch, { id: batch.id }, { retiredAt: null });
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Reactivate,
        batch,
        actor: params.actor,
        counts: { transcriptCount: conversationCount },
      });
      return R.success({ batch, conversationCount });
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

  /** Removes the batch, its conversations and their ratings, and every session checked against its schema. */
  delete(params: {
    batchId: string;
    actor: KoraActor;
  }): Promise<BatchResult<KoraDeletionImpact>> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return R.failure(KoraBatchActionError.NotFound);
      const impact = await impactOf(manager, batch.id);
      await dropUnrated(manager, batch.id);
      await manager.delete(KoraBatch, { id: batch.id });
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Delete,
        batch,
        actor: params.actor,
        counts: impact,
      });
      return R.success(impact);
    });
  }
}

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

const countConversations = (manager: EntityManager, batchId: string) =>
  manager.countBy(KoraConversation, { batchId });

async function dropUnrated(
  manager: EntityManager,
  batchId: string,
): Promise<void> {
  await manager.query(
    `DELETE FROM "kora_session_conversation" sc
     USING "kora_session" s, "kora_conversation" c
     WHERE sc."sessionId" = s."id" AND sc."conversationId" = c."id"
       AND c."batchId" = $1 AND sc."status" = $2
       AND s."endedAt" IS NULL AND s."deletedAt" IS NULL`,
    [batchId, KoraReviewStatus.Pending],
  );
}

async function impactOf(
  manager: EntityManager,
  batchId: string,
): Promise<KoraDeletionImpact> {
  const [row]: KoraDeletionImpact[] = await manager.query(
    `SELECT
       (SELECT COUNT(*)::int FROM "kora_conversation" WHERE "batchId" = $1)
         AS "transcriptCount",
       (SELECT COUNT(*)::int FROM "kora_session_conversation" sc
          JOIN "kora_session" s ON s."id" = sc."sessionId"
          JOIN "kora_conversation" c ON c."id" = sc."conversationId"
          WHERE sc."status" = $2 AND s."deletedAt" IS NULL
            AND (c."batchId" = $1 OR s."schemaBatchId" = $1))
         AS "ratingCount",
       (SELECT COUNT(*)::int FROM "kora_session"
          WHERE "schemaBatchId" = $1 AND "deletedAt" IS NULL)
         AS "assignmentCount"`,
    [batchId, KoraReviewStatus.Done],
  );
  return row;
}
