import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional } from 'class-validator';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Type } from 'class-transformer';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Ty } from 'src/tasks/entities/type';
import { GeneralUpdate } from 'src/actions/entities/general-update.entity';

@Entity()
export class Tag {
  // Fields

  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Allow()
  id: string;

  @Column()
  @ApiProperty()
  @Allow()
  name: string;

  @Column()
  @ApiProperty()
  @Allow()
  description: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  publicDisplayName?: string;

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

  // Relations

  @ManyToMany(() => User, (user) => user.tags, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => User, isArray: true })
  @Allow()
  @JoinTable()
  @Type(() => User)
  users: Ty<User>[];

  @ManyToMany(() => GeneralUpdate, (generalUpdate) => generalUpdate.tags)
  @ApiProperty({ type: () => GeneralUpdate, isArray: true })
  @Allow()
  @Type(() => GeneralUpdate)
  generalUpdates: GeneralUpdate[];
}
