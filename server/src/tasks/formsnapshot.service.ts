import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import jsonStableStringify from "json-stable-stringify";
import type { Repository } from "src/utils/Repository";
import { EntityManager, In, SelectQueryBuilder } from "typeorm";
import {
  FORM_SNAPSHOT_HISTORY_TABLE,
  FormSnapshot,
  SNAPSHOT_HISTORY_OWNERS,
  SnapshotHistoryOwner,
} from "./entities/formsnapshot.entity";
import { servedSchema } from "./served-schema";

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
       ON CONFLICT ("hash") DO UPDATE SET "deletedAt" = NULL
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
    const snapshot = await this.historyOf(formId)
      .andWhere("s.id = :formSnapshotId", { formSnapshotId })
      .getOne();
    if (!snapshot) {
      throw new BadRequestException(
        "Submitted form snapshot was never associated with this form",
      );
    }
    return snapshot;
  }

  // Snapshot rows never change, so a snapshot's served hash is computed once.
  private readonly servedHashes = new Map<number, string>();

  /** A legacy client echoes the schema getForm served, media rewrites
   * included, instead of the stored one. The rewrites are today's, so a client
   * that fetched a form before a rewrite changed gets a 400.
   * BACKCOMPAT(form-snapshot): a miss hashes the form's uncached history
   * versions, a cost that goes with the schemaSnapshot branch. */
  async findHistoricalBySchemaOrThrow(
    formId: number,
    schema: Record<string, unknown>,
  ): Promise<FormSnapshot> {
    const hash = hashFormSchema(schema);
    const snapshot =
      (await this.historyOf(formId)
        .andWhere("s.hash = :hash", { hash })
        .getOne()) ??
      (await this.findByServedHash(this.historyOf(formId), hash));
    if (!snapshot) {
      throw new BadRequestException(
        "Submitted schema does not match any historical snapshot for this form",
      );
    }
    return snapshot;
  }

  private historyOf(formId: number): SelectQueryBuilder<FormSnapshot> {
    return this.snapshotRepository
      .createQueryBuilder("s")
      .innerJoin(
        FORM_SNAPSHOT_HISTORY_TABLE,
        "fhs",
        'fhs."formSnapshotId" = s.id',
      )
      .where('fhs."formId" = :formId', { formId });
  }

  private async findByServedHash(
    candidates: SelectQueryBuilder<FormSnapshot>,
    hash: string,
  ): Promise<FormSnapshot | null> {
    const ids = (
      await candidates.select("s.id", "id").getRawMany<{ id: number }>()
    ).map((row) => row.id);
    const uncached = ids.filter((id) => !this.servedHashes.has(id));
    if (uncached.length > 0) {
      for (const snapshot of await this.snapshotRepository.findBy({
        id: In(uncached),
      })) {
        this.servedHashes.set(
          snapshot.id,
          hashFormSchema(servedSchema(snapshot)),
        );
      }
    }
    const match = ids.find((id) => this.servedHashes.get(id) === hash);
    return match === undefined
      ? null
      : this.snapshotRepository.findOneByOrFail({ id: match });
  }
}
