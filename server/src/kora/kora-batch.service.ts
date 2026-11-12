import { KoraBatchEventKind } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { DataSource } from "typeorm";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import { type KoraActor, logBatchEvent } from "./kora-batch-actions.service";
import { checkTranscripts, type RejectedLine } from "./kora-upload";

export type KoraBatchSummary = { batch: KoraBatch; transcriptCount: number };

@Injectable()
export class KoraBatchService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraBatch)
    private readonly batches: Repository<KoraBatch>,
    @InjectRepository(KoraTranscript)
    private readonly transcripts: Repository<KoraTranscript>,
  ) {}

  async list(): Promise<KoraBatchSummary[]> {
    const [batches, counts] = await Promise.all([
      this.batches.find({ order: { createdAt: "DESC" } }),
      this.transcripts
        .createQueryBuilder("t")
        .select(`t."batchId"`, "batchId")
        .addSelect("COUNT(*)::int", "count")
        .groupBy(`t."batchId"`)
        .getRawMany<{ batchId: string; count: number }>(),
    ]);
    const countOf = new Map(counts.map((c) => [c.batchId, c.count]));
    return batches.map((batch) => ({
      batch,
      transcriptCount: countOf.get(batch.id) ?? 0,
    }));
  }

  async upload(params: {
    transcriptsText: string;
    transcriptsPerAssignment: number;
    reviewsPerTranscript: number;
    actor: KoraActor;
  }): Promise<Result<KoraBatchSummary, RejectedLine[]>> {
    const existing = await this.transcripts.find({
      select: { id: true, batch: { retiredAt: true } },
      relations: { batch: true },
    });
    const checked = checkTranscripts({
      text: params.transcriptsText,
      existingIds: new Set(existing.map((t) => t.id)),
      retiredIds: new Set(
        existing.filter((t) => t.batch?.retiredAt).map((t) => t.id),
      ),
    });
    if (!checked.ok) {
      return R.failure(checked.error);
    }
    const batch = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(KoraBatch, {
        transcriptsPerAssignment: params.transcriptsPerAssignment,
        reviewsPerTranscript: params.reviewsPerTranscript,
      });
      await manager.insert(
        KoraTranscript,
        checked.value.map((t, position) => ({
          ...t,
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
    return R.success({ batch, transcriptCount: checked.value.length });
  }

  hasTranscripts(): Promise<boolean> {
    return this.transcripts.exists();
  }

  randomTranscript(batchId: string): Promise<KoraTranscript | null> {
    return this.transcripts
      .createQueryBuilder("t")
      .where(`t."batchId" = :batchId`, { batchId })
      .orderBy("random()")
      .limit(1)
      .getOne();
  }
}
