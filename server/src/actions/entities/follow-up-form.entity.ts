import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Action } from './action.entity';
import { Form } from 'src/tasks/entities/form.entity';
import type { Ty } from 'src/tasks/entities/type';

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
  action: Ty<Action>;

  @Column()
  @ApiProperty()
  @Allow()
  formId: number;

  @ManyToOne(() => Form, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  @Type(() => Form)
  @Allow()
  form: Ty<Form>;
}
