// src/forms/form.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsArray, IsDefined } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FormResponse } from './formresponse.entity';

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

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema!: Record<string, unknown>;

  @CreateDateColumn()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @OneToMany(() => FormResponse, (r: FormResponse) => r.form)
  @Type(() => FormResponse)
  @IsArray()
  responses: FormResponse[];
}
