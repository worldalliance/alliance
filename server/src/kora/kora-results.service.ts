import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { DataSource, IsNull, Not } from "typeorm";
import { KoraSession } from "./entities/kora-session.entity";

export type KoraExportBatch = { id: string; retired: boolean };

export type StoredExport = {
  reviewerId: string;
  exported: unknown;
  batches: KoraExportBatch[];
};

@Injectable()
export class KoraResultsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KoraSession)
    private readonly sessions: Repository<KoraSession>,
  ) {}

  /** Every stored export, oldest first; soft-deleted reviewers' are left out. */
  async exports(): Promise<StoredExport[]> {
    const [rows, batchRows] = await Promise.all([
      this.sessions.find({
        where: { export: Not(IsNull()), reviewer: { deletedAt: IsNull() } },
        relations: { reviewer: true },
        order: { createdAt: "ASC" },
      }),
      this.dataSource.query<
        { sessionId: string; id: string; retired: boolean }[]
      >(
        `SELECT DISTINCT sc."sessionId", b."id", b."retiredAt" IS NOT NULL AS "retired"
         FROM "kora_session_conversation" sc
         JOIN "kora_conversation" c ON c."id" = sc."conversationId"
         JOIN "kora_batch" b ON b."id" = c."batchId"
         ORDER BY b."id"`,
      ),
    ]);
    const batchesOf = Map.groupBy(batchRows, (r) => r.sessionId);
    return rows.map((row) => ({
      reviewerId: row.reviewerId,
      exported: row.export,
      batches: (batchesOf.get(row.id) ?? []).map(({ id, retired }) => ({
        id,
        retired,
      })),
    }));
  }

  session(id: string): Promise<KoraSession | null> {
    return this.sessions.findOneBy({ id });
  }
}
