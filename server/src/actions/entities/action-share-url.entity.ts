import { Type } from 'class-transformer';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Action } from './action.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

@Entity()
@Unique(['action', 'user'])
export class ActionShareUrl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  @Type(() => User)
  user: Relation<User>;

  @ManyToOne(() => Action, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actionId' })
  @Type(() => Action)
  action: Relation<Action>;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  sid?: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @Column({ type: 'jsonb' })
  @Type(() => Object)
  @ApiPropertyOptional({ type: Object })
  data?: Record<string, unknown>;
}
