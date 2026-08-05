// src/forms/form.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsArray, IsDefined } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FormResponse } from './formresponse.entity';
import {
  FORM_SNAPSHOT_HISTORY_TABLE,
  FormSnapshot,
} from './formsnapshot.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';

@Entity()
export class Form {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ type: 'text' })
  @ApiProperty()
  @IsDefined()
  title: string;

  @Column()
  @ApiProperty()
  @Allow()
  formSnapshotId: number;

  @ManyToOne(() => FormSnapshot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'formSnapshotId' })
  @Type(() => FormSnapshot)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  formSnapshot: Relation<FormSnapshot>;

  @ManyToMany(() => FormSnapshot)
  @JoinTable({
    name: FORM_SNAPSHOT_HISTORY_TABLE,
    joinColumn: { name: 'formId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'formSnapshotId', referencedColumnName: 'id' },
  })
  @Type(() => FormSnapshot)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  historicalFormSnapshots: Relation<FormSnapshot>[];

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @OneToMany(() => FormResponse, (r: FormResponse) => r.form)
  @Type(() => FormResponse)
  @IsArray()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  responses: Relation<FormResponse>[];
}
