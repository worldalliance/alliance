// src/forms/form-response.entity.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { DeviceVisibilityTarget } from '../schema';
import { Form } from './form.entity';
import { Ty } from './type';

@Entity()
@Unique(['user', 'formId'])
export class FormResponse {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsDefined()
  formId: number;

  @ManyToOne(() => Form, (f) => f.responses, { onDelete: 'CASCADE' })
  @IsDefined()
  @Type(() => Form)
  form: Ty<Form>;

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  @ApiProperty()
  @Allow()
  @Type(() => Object)
  visibilityValidatorResults: Record<string, boolean>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  @ApiProperty()
  @Allow()
  @Type(() => Object)
  publicAnswers: Record<string, boolean>;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @Type(() => String)
  deviceType?: DeviceVisibilityTarget;

  @ApiPropertyOptional({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @IsOptional()
  @Type(() => User)
  user?: Ty<User>;

  @CreateDateColumn()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schemaSnapshot: Record<string, unknown>;
}
