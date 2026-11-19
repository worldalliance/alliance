import { KoraBatchEventKind, KoraItemType } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { DataSource } from "typeorm";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraConversation } from "./entities/kora-conversation.entity";
import {
  type KoraActor,
  KoraBatchActionError,
  logBatchEvent,
} from "./kora-batch-actions.service";
import { checkConversations, type RejectedLine } from "./kora-upload";

/** SQL for session `s`'s closesAt: the earliest of its conversations' batches. */
const SESSION_CLOSES_AT = `SELECT MIN(b."closesAt") FROM "kora_session_conversation" sc
  JOIN "kora_conversation" c ON c."id" = sc."conversationId"
  JOIN "kora_batch" b ON b."id" = c."batchId"
  WHERE sc."sessionId" = s."id"`;

export type KoraBatchSummary = {
  batch: KoraBatch;
  conversationCount: number;
};

@Injectable()
export class KoraBatchService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraBatch)
    private readonly batches: Repository<KoraBatch>,
    @InjectRepository(KoraConversation)
    private readonly conversations: Repository<KoraConversation>,
  ) {}

  async list(): Promise<KoraBatchSummary[]> {
    const [batches, counts] = await Promise.all([
      this.batches.find({ order: { createdAt: "DESC" } }),
      this.conversations
        .createQueryBuilder("c")
        .select(`c."batchId"`, "batchId")
        .addSelect("COUNT(*)::int", "count")
        .groupBy(`c."batchId"`)
        .getRawMany<{ batchId: string; count: number }>(),
    ]);
    const countOf = new Map(counts.map((c) => [c.batchId, c.count]));
    return batches.map((batch) => ({
      batch,
      conversationCount: countOf.get(batch.id) ?? 0,
    }));
  }

  async upload(params: {
    conversationsText: string;
    reviewsPerConversation: number;
    closesAt: Date;
    actor: KoraActor;
  }): Promise<Result<KoraBatchSummary, RejectedLine[]>> {
    const existing = await this.conversations.find({
      select: { id: true, batch: { retiredAt: true } },
      relations: { batch: true },
    });
    const checked = checkConversations({
      text: params.conversationsText,
      existingIds: new Set(existing.map((c) => c.id)),
      retiredIds: new Set(
        existing.filter((c) => c.batch?.retiredAt).map((c) => c.id),
      ),
      existingPractice: await this.conversations.countBy({
        itemType: KoraItemType.Practice,
      }),
    });
    if (!checked.ok) {
      return R.failure(checked.error);
    }
    const batch = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(KoraBatch, {
        reviewsPerConversation: params.reviewsPerConversation,
        closesAt: params.closesAt,
      });
      await manager.insert(
        KoraConversation,
        checked.value.map((c, position) => ({
          id: c.id,
          riskId: c.riskId,
          itemType: c.itemType,
          nTurns: c.nTurns,
          optIn: c.optIn,
          content: c.content,
          contentHash: c.contentHash,
          batchId: saved.id,
          position,
        })),
      );
      await logBatchEvent(manager, {
        kind: KoraBatchEventKind.Upload,
        batch: saved,
        actor: params.actor,
        counts: { transcriptCount: checked.value.length },
      });
      return saved;
    });
    return R.success({ batch, conversationCount: checked.value.length });
  }

  setClosesAt(params: {
    batchId: string;
    closesAt: Date;
  }): Promise<Result<KoraBatchSummary, KoraBatchActionError>> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneBy(KoraBatch, { id: params.batchId });
      if (!batch) return R.failure(KoraBatchActionError.NotFound);
      batch.closesAt = params.closesAt;
      await manager.update(
        KoraBatch,
        { id: batch.id },
        { closesAt: batch.closesAt },
      );
      await manager.query(
        `UPDATE "kora_session" s SET "closesAt" = (${SESSION_CLOSES_AT})
         WHERE s."endedAt" IS NULL AND s."deletedAt" IS NULL AND EXISTS (
           SELECT 1 FROM "kora_session_conversation" sc
           JOIN "kora_conversation" c ON c."id" = sc."conversationId"
           WHERE sc."sessionId" = s."id" AND c."batchId" = $1
         )`,
        [batch.id],
      );
      return R.success({
        batch,
        conversationCount: await manager.countBy(KoraConversation, {
          batchId: batch.id,
        }),
      });
    });
  }

  hasConversations(): Promise<boolean> {
    return this.conversations.exists();
  }

  randomConversation(batchId: string): Promise<KoraConversation | null> {
    return this.conversations
      .createQueryBuilder("c")
      .where(`c."batchId" = :batchId`, { batchId })
      .orderBy("random()")
      .limit(1)
      .getOne();
  }
}
