import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Action } from './action.entity';
import { User } from '../../user/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum ActionActivityType {
  USER_JOINED = 'user_joined',
  USER_COMPLETED = 'user_completed',
}

@Entity()
export class ActionActivity {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({ type: 'enum', enum: ActionActivityType })
  @ApiProperty({
    description: 'Type of action activity',
    enum: ActionActivityType,
  })
  type: ActionActivityType;

  @ManyToOne(() => Action, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actionId' })
  action: Action;

  @Column()
  @ApiProperty()
  actionId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @ApiProperty()
  userId: number;

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  // just for donation-based actions
  @Column({ nullable: true })
  @ApiProperty()
  dollar_amount?: number;
}
