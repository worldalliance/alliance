import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'src/utils/Repository';
import type { ActionPartnershipResponse } from './action-partnership-response.entity';

@Entity()
export class ActionPartnershipNote {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator
  @ManyToOne(
    'ActionPartnershipResponse',
    (response: ActionPartnershipResponse) => response.notesHistory,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({ name: 'responseId' })
  @IsOptional()
  response?: Relation<ActionPartnershipResponse>;

  @Column({ type: 'int' })
  @ApiProperty()
  @Allow()
  responseId: number;

  @Column({ type: 'timestamptz' })
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  noteDate: Date;

  @Column({ type: 'text' })
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

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
}
