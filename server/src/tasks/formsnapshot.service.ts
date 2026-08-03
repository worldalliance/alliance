import { createHash } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import jsonStableStringify from 'json-stable-stringify';
import { EntityManager } from 'typeorm';
import type { Repository } from 'src/utils/Repository';
import {
  FORM_SNAPSHOT_HISTORY_TABLE,
  FormSnapshot,
} from './entities/formsnapshot.entity';

export function hashFormSchema(schema: Record<string, unknown>): string {
  return createHash('sha256')
    .update(jsonStableStringify(schema) ?? '')
    .digest('hex');
}

@Injectable()
export class FormSnapshotService {
  constructor(
    @InjectRepository(FormSnapshot)
    private readonly snapshotRepository: Repository<FormSnapshot>,
  ) {}

  async findOrCreate(schema: Record<string, unknown>): Promise<FormSnapshot> {
    const hash = hashFormSchema(schema);
    const rows = await this.snapshotRepository.query<{ id: number }[]>(
      `INSERT INTO form_snapshot ("schema", "hash") VALUES ($1::jsonb, $2)
       ON CONFLICT ("hash") DO UPDATE SET "schema" = form_snapshot."schema"
       RETURNING id`,
      [JSON.stringify(schema), hash],
    );
    if (rows.length === 0) {
      throw new Error('FormSnapshot.findOrCreate: upsert returned no rows');
    }
    return this.snapshotRepository.findOneByOrFail({ id: rows[0].id });
  }

  async recordHistorical(
    formId: number,
    formSnapshotId: number,
    em?: EntityManager,
  ): Promise<void> {
    const runner = em ?? this.snapshotRepository.manager;
    await runner.query(
      `INSERT INTO "${FORM_SNAPSHOT_HISTORY_TABLE}" ("formId", "formSnapshotId")
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [formId, formSnapshotId],
    );
  }

  async findHistoricalOrThrow(
    formId: number,
    formSnapshotId: number,
  ): Promise<FormSnapshot> {
    const snapshot = await this.snapshotRepository
      .createQueryBuilder('s')
      .innerJoin(
        FORM_SNAPSHOT_HISTORY_TABLE,
        'fhs',
        'fhs."formSnapshotId" = s.id',
      )
      .where('fhs."formId" = :formId', { formId })
      .andWhere('s.id = :formSnapshotId', { formSnapshotId })
      .getOne();
    if (!snapshot) {
      throw new BadRequestException(
        'Submitted form snapshot was never associated with this form',
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
      .createQueryBuilder('s')
      .innerJoin(
        FORM_SNAPSHOT_HISTORY_TABLE,
        'fhs',
        'fhs."formSnapshotId" = s.id',
      )
      .where('fhs."formId" = :formId', { formId })
      .andWhere('s.hash = :hash', { hash })
      .getOne();
    if (!snapshot) {
      throw new BadRequestException(
        'Submitted schema does not match any historical snapshot for this form',
      );
    }
    return snapshot;
  }
}
