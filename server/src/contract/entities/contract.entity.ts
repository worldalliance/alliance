import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsArray, IsOptional, IsString } from 'class-validator';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import { ContractEvent } from 'src/user/entities/contract-event.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Contract {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  name: string | null;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column()
  @ApiProperty()
  @IsString()
  markdown: string;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  @IsOptional()
  startDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @IsOptional()
  @Type(() => Date)
  endDate: Date | null;

  // Relations

  @OneToMany(() => ContractEvent, (event) => event.contract)
  @ApiProperty({
    type: () => ContractEvent,
    isArray: true,
  })
  @Allow()
  @IsArray()
  @Type(() => ContractEvent)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  events: Relation<ContractEvent>[];
}
