import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined } from 'class-validator';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';

export const FORM_SNAPSHOT_HISTORY_TABLE = 'form_snapshot_history';
export const GENERAL_UPDATE_SNAPSHOT_HISTORY_TABLE =
  'general_update_snapshot_history';

export enum SnapshotHistoryOwner {
  Form = 'form',
  GeneralUpdate = 'generalUpdate',
}

export const SNAPSHOT_HISTORY_OWNERS = {
  [SnapshotHistoryOwner.Form]: {
    table: FORM_SNAPSHOT_HISTORY_TABLE,
    ownerColumn: 'formId',
    snapshotColumn: 'formSnapshotId',
  },
  [SnapshotHistoryOwner.GeneralUpdate]: {
    table: GENERAL_UPDATE_SNAPSHOT_HISTORY_TABLE,
    ownerColumn: 'generalUpdateId',
    snapshotColumn: 'schemaSnapshotId',
  },
} as const satisfies Record<
  SnapshotHistoryOwner,
  { table: string; ownerColumn: string; snapshotColumn: string }
>;

// Immutable schema snapshot shared by forms and general updates.
@Entity()
@Index('IDX_form_snapshot_hash', ['hash'], { unique: true })
export class FormSnapshot {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema: Record<string, unknown>;

  @Column({ type: 'text' })
  @ApiProperty()
  @Allow()
  hash: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;
}
