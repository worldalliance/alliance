import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined } from 'class-validator';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FormResponse } from './formresponse.entity';

@Entity()
export class FormResponseVersion {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  formResponseId: number;

  @ManyToOne(() => FormResponse, { onDelete: 'CASCADE' })
  @IsDefined()
  @Type(() => FormResponse)
  formResponse: Relation<FormResponse>;

  @Column()
  @ApiProperty()
  @Allow()
  version: number;

  @Column({ type: 'jsonb' })
  @ApiProperty()
  @Allow()
  @Type(() => Object)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;
}
