// src/forms/form-response.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined } from 'class-validator';
import { User } from 'src/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Form } from './form.entity';

@Entity()
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
  form: Form;

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @IsDefined()
  @Type(() => User)
  user: User;

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
