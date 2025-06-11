import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Action } from './action.entity';
import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  All = 'all',
  Joined = 'joined',
  None = 'none',
}

export enum ActionStatus {
  Active = 'active',
  Upcoming = 'upcoming',
  Past = 'past',
  Draft = 'draft',
}

@Entity()
export class ActionEvent {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the action event' })
  id: number;

  @IsNotEmpty()
  @Column()
  @ApiProperty({ description: 'Title of the event' })
  title: string;

  @Column()
  @ApiProperty({ description: 'secondary text' })
  description: string;

  @Column()
  @IsNotEmpty()
  @ApiProperty({
    description: 'New status of the action after the event',
    enum: ActionStatus,
  })
  newStatus: ActionStatus;

  @Column({ type: 'text' })
  @IsNotEmpty()
  @ApiProperty({
    description: 'Notification type for the event',
    enum: NotificationType,
  })
  sendNotifsTo: NotificationType;

  @Column()
  @ApiProperty({ description: 'time of the event (for display)' })
  date: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Timestamp when the event was last updated' })
  updateDate: Date;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates whether the event should be shown in the timeline',
    default: false,
  })
  showInTimeline: boolean;

  @ManyToOne(() => Action, (action) => action.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionId' })
  @ApiProperty({
    description: 'The action associated with this event',
    type: () => Action,
  })
  action: Action;
}
