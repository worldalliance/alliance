import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema!: Record<string, unknown>;

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
