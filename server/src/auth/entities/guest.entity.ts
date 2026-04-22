import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { User } from 'src/user/entities/user.entity';
import type { Relation } from 'src/utils/Repository';

@Entity()
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Allow()
  id: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Index()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @ApiPropertyOptional({ type: () => User })
  @IsOptional()
  @Type(() => User)
  linkedUser?: Relation<User> | null;
}
