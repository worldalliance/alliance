import {
  cohortExpressionSchema,
  type CohortExpression,
} from '@alliance/common/cohort-expression';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import { Form } from 'src/tasks/entities/form.entity';
import type { Relation } from 'src/utils/Repository';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Action } from './action.entity';

@Entity()
export class FollowUpForm {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  @Allow()
  @IsOptional()
  name?: string;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({
    type: Date,
    nullable: true,
  })
  @Type(() => Date)
  @Allow()
  @IsOptional()
  startDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({
    type: Date,
    nullable: true,
  })
  @Type(() => Date)
  @Allow()
  @IsOptional()
  endDate?: Date;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  @Allow()
  @IsOptional()
  instructions?: string;

  @Column({ type: 'jsonb', nullable: true })
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Object)
  cohortExpression?: unknown;

  // Relations

  @Column()
  @ApiProperty()
  @Allow()
  actionId: number;

  @ManyToOne(() => Action, (action) => action.followUpForms, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionId' })
  @Type(() => Action)
  @Allow()
  action: Relation<Action>;

  @Column()
  @ApiProperty()
  @Allow()
  formId: number;

  @ManyToOne(() => Form, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  @Type(() => Form)
  @Allow()
  form: Relation<Form>;
}

/**
 * A FollowUpForm whose jsonb columns have been parsed. Produce with {@link
 * parseFollowUpForm} immediately after pulling one from the db (or any other
 * untyped source), so the parse happens exactly once and everything downstream
 * works with a typed expression.
 */
export type ParsedFollowUpForm = FollowUpForm & {
  cohortExpression: CohortExpression | null;
};

export function parseFollowUpForm(form: FollowUpForm): ParsedFollowUpForm {
  form.cohortExpression =
    form.cohortExpression == null
      ? null
      : cohortExpressionSchema.parse(form.cohortExpression);
  // Mutate-and-cast (rather than spread) to keep the entity's prototype; the
  // assignment above just validated the only field the cast narrows.
  return form as ParsedFollowUpForm;
}
