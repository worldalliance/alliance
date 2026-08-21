import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import jsonStableStringify from "json-stable-stringify";
import type { Repository } from "src/utils/Repository";
import { EntityManager } from "typeorm";
import {
  FORM_SNAPSHOT_HISTORY_TABLE,
  FormSnapshot,
  SNAPSHOT_HISTORY_OWNERS,
  SnapshotHistoryOwner,
} from "./entities/formsnapshot.entity";

export function hashFormSchema(schema: Record<string, unknown>): string {
  return createHash("sha256")
    .update(jsonStableStringify(schema) ?? "")
    .digest("hex");
}

@Injectable()
export class FormSnapshotService {
  constructor(
    @InjectRepository(FormSnapshot)
    private readonly snapshotRepository: Repository<FormSnapshot>,
  ) {}

  async findOrCreate(
    schema: Record<string, unknown>,
    em?: EntityManager,
  ): Promise<FormSnapshot> {
    const hash = hashFormSchema(schema);
    const runner = em ?? this.snapshotRepository.manager;
    const rows = await runner.query<{ id: number }[]>(
      `INSERT INTO form_snapshot ("schema", "hash") VALUES ($1::jsonb, $2)
       ON CONFLICT ("hash") DO UPDATE SET "schema" = form_snapshot."schema"
       RETURNING id`,
      [JSON.stringify(schema), hash],
    );
    if (rows.length === 0) {
      throw new Error("FormSnapshot.findOrCreate: upsert returned no rows");
    }
    return runner.findOneByOrFail(FormSnapshot, { id: rows[0].id });
  }

  // SQL identifiers come from the exhaustive owner table, never caller input.
  async recordHistorical(params: {
    owner: SnapshotHistoryOwner;
    ownerId: number;
    snapshotId: number;
    em?: EntityManager;
  }): Promise<void> {
    const { table, ownerColumn, snapshotColumn } =
      SNAPSHOT_HISTORY_OWNERS[params.owner];
    const runner = params.em ?? this.snapshotRepository.manager;
    await runner.query(
      `INSERT INTO "${table}" ("${ownerColumn}", "${snapshotColumn}")
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [params.ownerId, params.snapshotId],
    );
  }

  async findHistoricalOrThrow(
    formId: number,
    formSnapshotId: number,
  ): Promise<FormSnapshot> {
    const snapshot = await this.snapshotRepository
      .createQueryBuilder("s")
      .innerJoin(
        FORM_SNAPSHOT_HISTORY_TABLE,
        "fhs",
        'fhs."formSnapshotId" = s.id',
      )
      .where('fhs."formId" = :formId', { formId })
      .andWhere("s.id = :formSnapshotId", { formSnapshotId })
      .getOne();
    if (!snapshot) {
      throw new BadRequestException(
        "Submitted form snapshot was never associated with this form",
      );
    }
    return snapshot;
  }

  async findHistoricalBySchemaOrThrow(
    formId: number,
    schema: Record<string, unknown>,
  ): Promise<FormSnapshot> {
    const hash = hashFormSchema(schema);
    const snapshot = await this.snapshotRepository
      .createQueryBuilder("s")
      .innerJoin(
        FORM_SNAPSHOT_HISTORY_TABLE,
        "fhs",
        'fhs."formSnapshotId" = s.id',
      )
      .where('fhs."formId" = :formId', { formId })
      .andWhere("s.hash = :hash", { hash })
      .getOne();
    if (!snapshot) {
      throw new BadRequestException(
        "Submitted schema does not match any historical snapshot for this form",
      );
    }
    return snapshot;
  }
}
