import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsEnum, IsOptional } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Type } from 'class-transformer';
import { Ty } from 'src/tasks/entities/type';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';

export enum UserAwayRangeReason {
  VACATION = 'vacation',
  EMERGENCY = 'emergency',
  OTHER = 'other',
}

@Entity()
export class UserAwayRange {
  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  @Allow()
  @Type(() => User)
  user: Ty<User>;

  @Column()
  @ApiProperty()
  @Allow()
  userId: number;

  @Column({ type: 'timestamptz' })
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  startDate: Date;

  @Column({ type: 'timestamptz' })
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  endDate: Date;

  @CreateDateColumnTz()
  @Allow()
  @ApiProperty()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @Allow()
  @ApiProperty()
  @Type(() => Date)
  updatedAt: Date;

  @Column({
    type: 'enum',
    enum: UserAwayRangeReason,
    default: UserAwayRangeReason.OTHER,
  })
  @ApiProperty({
    enum: UserAwayRangeReason,
    enumName: 'UserAwayRangeReason',
  })
  @IsEnum(UserAwayRangeReason)
  reason: UserAwayRangeReason;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  note?: string;
}
