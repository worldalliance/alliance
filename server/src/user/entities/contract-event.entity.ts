import { UpdateDateColumnTz } from 'src/datasources/basecolumns';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Ty } from 'src/tasks/entities/type';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ContractEventType {
  SIGNED = 'signed',
  SUSPENDED = 'suspended',
}

@Entity()
@Index(['user', 'date'])
@Unique(['user', 'autoSuspendKey'])
export class ContractEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ContractEventType })
  @ApiProperty({ enum: ContractEventType, enumName: 'ContractEventType' })
  type: ContractEventType;

  @Column({ type: 'timestamptz' })
  @ApiProperty()
  @Type(() => Date)
  date: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.contractEvents, { onDelete: 'CASCADE' })
  user: Ty<User>;

  @Column({ default: false })
  @ApiProperty()
  automatic: boolean;

  @Column({ nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  autoSuspendKey?: string;
}
