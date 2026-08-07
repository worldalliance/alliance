import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
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
import {
  FormSnapshot,
  GENERAL_UPDATE_SNAPSHOT_HISTORY_TABLE,
} from 'src/tasks/entities/formsnapshot.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { GeneralUpdateActivity } from './general-update-activity.entity';
import type { Relation } from 'src/utils/Repository';
import { Tag } from 'src/user/entities/tag.entity';
import { ActionSuite } from './action-suite.entity';

@Entity()
export class GeneralUpdate {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ type: 'text' })
  @ApiProperty()
  @IsDefined()
  name: string;

  @Column()
  @ApiProperty()
  @Allow()
  schemaSnapshotId: number;

  @ManyToOne(() => FormSnapshot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'schemaSnapshotId' })
  @Type(() => FormSnapshot)
  @IsOptional()
  schemaSnapshot?: Relation<FormSnapshot>;

  @ManyToMany(() => FormSnapshot)
  @JoinTable({
    name: GENERAL_UPDATE_SNAPSHOT_HISTORY_TABLE,
    joinColumn: { name: 'generalUpdateId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'schemaSnapshotId', referencedColumnName: 'id' },
  })
  @Type(() => FormSnapshot)
  @IsOptional()
  historicalSchemaSnapshots?: Relation<FormSnapshot>[];

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

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional()
  @Type(() => Date)
  @Allow()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  startDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional()
  @Type(() => Date)
  @Allow()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  endDate?: Date;

  @Column({ default: false })
  @ApiProperty()
  @IsDefined()
  useManualCohort: boolean;

  @Column('int', { array: true, nullable: true })
  @Allow()
  @ApiPropertyOptional({
    description: 'User IDs in the manual cohort',
    type: [Number],
    nullable: true,
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  manualCohortUserIds?: number[] | null;

  @Column({ default: 0 })
  @ApiProperty()
  @IsDefined()
  priority: number;

  // Relations

  @OneToMany(() => GeneralUpdateActivity, (activity) => activity.generalUpdate)
  @Type(() => GeneralUpdateActivity)
  @IsOptional()
  activities?: Relation<GeneralUpdateActivity>[];

  @ManyToMany(() => Tag, (tag) => tag.generalUpdates, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => Tag, isArray: true })
  @Allow()
  @JoinTable()
  @Type(() => Tag)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  tags: Relation<Tag>[];

  @ManyToMany(() => ActionSuite, (suite) => suite.generalUpdates, {
    nullable: true,
  })
  @ApiPropertyOptional({ type: () => ActionSuite, isArray: true })
  @Type(() => ActionSuite)
  @JoinTable()
  @IsOptional()
  suites?: Relation<ActionSuite>[];
}
