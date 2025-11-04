import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Type } from 'class-transformer';

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
  user: User;

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

  @CreateDateColumn()
  @Allow()
  @ApiProperty()
  @Type(() => Date)
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  note?: string;
}
