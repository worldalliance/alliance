import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { IsNull, Not } from "typeorm";
import { KoraAssignment } from "./entities/kora-assignment.entity";

export type StoredExport = { reviewerId: string; exported: unknown };

@Injectable()
export class KoraResultsService {
  constructor(
    @InjectRepository(KoraAssignment)
    private readonly assignments: Repository<KoraAssignment>,
  ) {}

  /** Every stored export, oldest first; soft-deleted reviewers' are left out. */
  async exports(): Promise<StoredExport[]> {
    const rows = await this.assignments.find({
      where: { export: Not(IsNull()), reviewer: { deletedAt: IsNull() } },
      relations: { reviewer: true },
      order: { createdAt: "ASC" },
    });
    return rows.map((row) => ({
      reviewerId: row.reviewerId,
      exported: row.export,
    }));
  }
}
