import { exportSchema } from "@alliance/kora-review/schemas";
import type { KoraExport } from "@alliance/kora-review/types";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { DataSource, IsNull, Not } from "typeorm";
import { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraReviewer } from "./entities/kora-reviewer.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import type { KoraSpecInput } from "./kora-spec-export";
import { koraAjv } from "./kora-upload";

const validExport = koraAjv().compile<KoraExport>(exportSchema);

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
    @InjectRepository(KoraReviewer)
    private readonly reviewers: Repository<KoraReviewer>,
    @InjectRepository(KoraTranscript)
    private readonly transcripts: Repository<KoraTranscript>,
  ) {}

  /** What KORA's export is built from. Stored exports were validated on save, so one that no longer fits the schema fails loudly. */
  async specExportInput(): Promise<
    Pick<KoraSpecInput, "reviewers" | "assignments" | "conversations">
  > {
    const [reviewers, rows, transcripts] = await Promise.all([
      this.reviewers.find({
        where: { deletedAt: IsNull() },
        order: { createdAt: "ASC" },
      }),
      this.assignments.find({
        where: { export: Not(IsNull()), reviewer: { deletedAt: IsNull() } },
        order: { createdAt: "ASC" },
      }),
      this.transcripts.find({ select: { id: true, content: true } }),
    ]);
    const assignments = rows.map((row) => {
      if (!validExport(row.export))
        throw new Error(
          `Assignment ${row.id}'s stored export doesn't match exportSchema`,
        );
      return {
        id: row.id,
        reviewerId: row.reviewerId,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        exported: row.export,
      };
    });
    return {
      reviewers: reviewers.map(({ id, createdAt }) => ({ id, createdAt })),
      assignments,
      conversations: new Map(
        transcripts.map((t) => [t.id, conversationOf(t.content)]),
      ),
    };
  }

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

function conversationOf(content: unknown): {
  itemType: string;
  conversation: { text: string }[];
} {
  const c =
    content && typeof content === "object"
      ? Object.fromEntries(Object.entries(content))
      : {};
  const turns = Array.isArray(c.conversation) ? c.conversation : [];
  return {
    itemType: typeof c.itemType === "string" ? c.itemType : "scored",
    conversation: turns.map((t: unknown) => ({
      text:
        t && typeof t === "object" && "text" in t && typeof t.text === "string"
          ? t.text
          : "",
    })),
  };
}
