// src/forms/form-response.entity.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import { User } from 'src/user/entities/user.entity';
import {
  Check,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import type { DeviceVisibilityTarget } from '@alliance/common/forms/device';
import { Guest } from 'src/auth/entities/guest.entity';
import { Form } from './form.entity';
import type { Relation } from 'src/utils/Repository';

@Entity()
@Index(['user', 'formId'])
@Check(`NOT ("userId" IS NOT NULL AND "guestId" IS NOT NULL)`)
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
  form: Relation<Form>;

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
  user?: Relation<User>;

  @ApiPropertyOptional({ type: () => Guest })
  @ManyToOne(() => Guest, { onDelete: 'CASCADE', nullable: true })
  @IsOptional()
  @Type(() => Guest)
  guest?: Relation<Guest>;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  sessionReplayUrl?: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  phDistinctId?: string;

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schemaSnapshot: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @Type(() => String)
  sid?: string;
}
