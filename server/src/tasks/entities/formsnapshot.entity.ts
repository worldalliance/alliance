import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined } from 'class-validator';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';

export const FORM_SNAPSHOT_HISTORY_TABLE = 'form_snapshot_history';
export const GENERAL_UPDATE_SNAPSHOT_HISTORY_TABLE =
  'general_update_snapshot_history';
export const ACTION_UPDATE_SNAPSHOT_HISTORY_TABLE =
  'action_update_snapshot_history';

export enum SnapshotHistoryOwner {
  Form = 'form',
  GeneralUpdate = 'generalUpdate',
  ActionUpdate = 'actionUpdate',
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
  [SnapshotHistoryOwner.ActionUpdate]: {
    table: ACTION_UPDATE_SNAPSHOT_HISTORY_TABLE,
    ownerColumn: 'actionUpdateId',
    snapshotColumn: 'schemaSnapshotId',
  },
} as const satisfies Record<
  SnapshotHistoryOwner,
  { table: string; ownerColumn: string; snapshotColumn: string }
>;

@Entity()
@Index('IDX_form_snapshot_hash', ['hash'], { unique: true })
export class FormSnapshot {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  // Update owners must narrow this with `displayOnlySchemaOf`; form snapshots
  // have a different schema shape.
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
