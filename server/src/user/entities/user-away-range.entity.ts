import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class UserAwayRange {
  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @ApiProperty()
  userId: number;

  @Column({ type: 'timestamptz' })
  @ApiProperty({ type: String, format: 'date-time' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  @ApiProperty({ type: 'date-time' })
  endDate: Date;

  @CreateDateColumn()
  @Allow()
  @ApiProperty()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ nullable: true })
  note?: string;
}
