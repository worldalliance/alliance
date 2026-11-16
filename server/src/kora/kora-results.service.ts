import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { DataSource, IsNull, Not } from "typeorm";
import { KoraAssignment } from "./entities/kora-assignment.entity";

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
    @InjectRepository(KoraAssignment)
    private readonly assignments: Repository<KoraAssignment>,
  ) {}

  /** Every stored export, oldest first; soft-deleted reviewers' are left out. */
  async exports(): Promise<StoredExport[]> {
    const [rows, batchRows] = await Promise.all([
      this.assignments.find({
        where: { export: Not(IsNull()), reviewer: { deletedAt: IsNull() } },
        relations: { reviewer: true },
        order: { createdAt: "ASC" },
      }),
      this.dataSource.query<
        { assignmentId: string; id: string; retired: boolean }[]
      >(
        `SELECT DISTINCT at."assignmentId", b."id", b."retiredAt" IS NOT NULL AS "retired"
         FROM "kora_assignment_transcript" at
         JOIN "kora_transcript" t ON t."id" = at."transcriptId"
         JOIN "kora_batch" b ON b."id" = t."batchId"
         ORDER BY b."id"`,
      ),
    ]);
    const batchesOf = Map.groupBy(batchRows, (r) => r.assignmentId);
    return rows.map((row) => ({
      reviewerId: row.reviewerId,
      exported: row.export,
      batches: (batchesOf.get(row.id) ?? []).map(({ id, retired }) => ({
        id,
        retired,
      })),
    }));
  }

  assignment(id: string): Promise<KoraAssignment | null> {
    return this.assignments.findOneBy({ id });
  }
}
