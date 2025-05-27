import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Action } from './action.entity';

export enum ActionStatus {
  Active = 'active',
  Upcoming = 'upcoming',
  Past = 'past',
  Draft = 'draft',
}

export enum NotificationType {
  All = 'all',
  Joined = 'joined',
  None = 'none',
}

@Entity()
export class ActionUpdate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string;

  @Column({
    type: 'enum',
    enum: ActionStatus,
  })
  newStatus: ActionStatus;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  sendNotifs: NotificationType;

  @CreateDateColumn()
  updateDate: Date;

  @Column({ default: false })
  showInTimeline: boolean;

  @ManyToOne(() => Action, (action) => action.updates, {
    onDelete: 'CASCADE',
  })
  action: Action;
}